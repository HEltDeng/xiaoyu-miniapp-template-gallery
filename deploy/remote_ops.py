"""Secure, narrow SSH inspection and static staging for the template Gallery."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import sys
from datetime import datetime, timezone
from textwrap import dedent
from uuid import uuid4

import paramiko
from cryptography import x509
from cryptography.hazmat.primitives import serialization


TARGET_ROOT = "/var/www/templates-mychangliapp"
PENDING_NGINX = "/etc/nginx/sites-available/templates-mychangliapp.pending"
FINAL_NGINX = "/etc/nginx/sites-available/templates-mychangliapp"
ENABLED_NGINX = "/etc/nginx/sites-enabled/templates-mychangliapp"
CERT_DIR = "/etc/nginx/ssl/templates.mychangliapp.cn"
REMOTE_CERT = f"{CERT_DIR}/templates.mychangliapp.cn_bundle.crt"
REMOTE_KEY = f"{CERT_DIR}/templates.mychangliapp.cn.key"
BACKUP_PARENT = "/var/backups/mychangli"


def required(name: str) -> str:
    value = os.environ.pop(name, "")
    if not value:
        raise RuntimeError(f"Missing required runtime value: {name}")
    return value


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def local_files(dist: Path) -> list[tuple[Path, str]]:
    files: list[tuple[Path, str]] = []
    for path in sorted(dist.rglob("*")):
        if path.is_symlink():
            raise RuntimeError("Gallery dist must not contain symbolic links")
        if not path.is_file():
            continue
        relative = path.relative_to(dist).as_posix()
        if relative == ".deployment-manifest.sha256" or relative.startswith(".openai/"):
            continue
        files.append((path, relative))
    if not files or not any(relative == "index.html" for _, relative in files):
        raise RuntimeError("Gallery dist is empty or incomplete")
    return files


def pending_nginx() -> str:
    return dedent(
        f"""
        server {{
            listen 80;
            listen [::]:80;
            server_name templates.mychangliapp.cn;
            root {TARGET_ROOT};
            index index.html;
            add_header X-Content-Type-Options "nosniff" always;
            add_header Referrer-Policy "strict-origin-when-cross-origin" always;
            location /demo/ {{
                add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval'; frame-ancestors 'self'" always;
                try_files $uri $uri/ =404;
            }}
            location / {{
                try_files $uri $uri/ =404;
            }}
        }}
        """
    ).strip() + "\n"


def https_nginx() -> str:
    return dedent(
        f"""
        server {{
            listen 80;
            listen [::]:80;
            server_name templates.mychangliapp.cn;
            return 301 https://$host$request_uri;
        }}

        server {{
            listen 443 ssl;
            listen [::]:443 ssl;
            server_name templates.mychangliapp.cn;

            ssl_certificate {REMOTE_CERT};
            ssl_certificate_key {REMOTE_KEY};
            ssl_protocols TLSv1.2 TLSv1.3;

            root {TARGET_ROOT};
            index index.html;
            add_header X-Content-Type-Options "nosniff" always;
            add_header Referrer-Policy "strict-origin-when-cross-origin" always;
            add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src 'self'; frame-ancestors 'self'" always;

            location /demo/ {{
                add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval'; frame-ancestors 'self'" always;
                try_files $uri $uri/ =404;
            }}
            location / {{
                try_files $uri $uri/ =404;
            }}
        }}
        """
    ).strip() + "\n"


def main() -> int:
    host = required("MY_CHANGLI_BACKEND_HOST")
    username = required("MY_CHANGLI_BACKEND_USER")
    identity_file = required("MY_CHANGLI_BACKEND_IDENTITY_FILE")
    key_passphrase = os.environ.pop("MY_CHANGLI_BACKEND_KEY_PASSPHRASE", "")
    sudo_password = required("MY_CHANGLI_BACKEND_SUDO_PASSWORD")
    port = int(os.environ.pop("MY_CHANGLI_BACKEND_PORT", "22"))
    action = required("MY_CHANGLI_GALLERY_ACTION")
    dist = Path(os.environ.pop("MY_CHANGLI_GALLERY_DIST", "")).resolve()
    cert_path = Path(os.environ.pop("MY_CHANGLI_GALLERY_CERT", "")).resolve()
    key_path = Path(os.environ.pop("MY_CHANGLI_GALLERY_KEY", "")).resolve()
    files = local_files(dist) if action == "deploystatic" else []

    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.RejectPolicy())

    def run(command: str, *, sudo: bool = False, timeout: int = 120) -> str:
        remote_command = command
        if sudo:
            remote_command = "sudo -S -p '' -- /bin/sh -c " + shlex.quote(command)
        stdin, stdout, stderr = client.exec_command(remote_command, get_pty=sudo, timeout=timeout)
        if sudo:
            stdin.write(sudo_password + "\n")
            stdin.flush()
        output = stdout.read().decode("utf-8", errors="replace")
        error = stderr.read().decode("utf-8", errors="replace")
        exit_code = stdout.channel.recv_exit_status()
        if exit_code != 0:
            message = (error or output).strip()
            raise RuntimeError(f"Remote command failed with exit code {exit_code}: {message[:500]}")
        return output.strip()

    try:
        client.connect(
            hostname=host,
            port=port,
            username=username,
            key_filename=identity_file,
            passphrase=key_passphrase or None,
            look_for_keys=False,
            allow_agent=False,
            timeout=15,
            auth_timeout=15,
            banner_timeout=15,
        )
        if action == "inspect":
            inspect(run)
            return 0
        if action == "enablehttp":
            enable_http(run)
            return 0
        if action == "deployhttps":
            deploy_https(run, client, cert_path, key_path)
            return 0
        if action != "deploystatic":
            raise RuntimeError("Unsupported Gallery action")
        deploy(run, client, files)
        return 0
    finally:
        client.close()
        key_passphrase = ""
        sudo_password = ""


def inspect(run) -> None:
    print("SERVER=" + run("hostname -f 2>/dev/null || hostname"))
    print("NGINX_TEST=" + run("/usr/sbin/nginx -t 2>&1", sudo=True).replace("\n", " | "))
    config_lines = run(
        "/usr/bin/grep -R -h -E "
        + shlex.quote(r"^[[:space:]]*(server_name|root|ssl_certificate|proxy_pass|return 301)")
        + " /etc/nginx/sites-enabled /etc/nginx/sites-available /etc/nginx/conf.d 2>/dev/null || true",
        sudo=True,
    )
    print("NGINX_RELEVANT_LINES=" + config_lines.replace("\n", " | "))
    certs = run(
        "/usr/bin/find /etc/letsencrypt/live -maxdepth 2 -type f "
        + "\\( -name fullchain.pem -o -name cert.pem \\) -print 2>/dev/null | sort || true",
        sudo=True,
    )
    print("LE_CERT_FILES=" + certs.replace("\n", " | "))
    print("TARGET_ROOT=" + run(f"if test -d {shlex.quote(TARGET_ROOT)}; then stat -c '%A %U:%G %n' {shlex.quote(TARGET_ROOT)}; else echo MISSING; fi", sudo=True))
    print("NGINX_STATUS=" + run("/usr/bin/systemctl is-active nginx; /usr/bin/ss -ltn 2>/dev/null | grep -E ':(80|443|8787) ' || true", sudo=True).replace("\n", " | "))
    print("PENDING_CONFIG=" + run(f"if test -f {shlex.quote(PENDING_NGINX)}; then echo PRESENT; else echo ABSENT; fi", sudo=True))
    print("PENDING_ENABLED=" + run("if test -L /etc/nginx/sites-enabled/templates-mychangliapp.pending; then readlink -f /etc/nginx/sites-enabled/templates-mychangliapp.pending; else echo ABSENT; fi", sudo=True))
    print("FINAL_CONFIG=" + run(f"if test -f {shlex.quote(FINAL_NGINX)}; then echo PRESENT; else echo ABSENT; fi", sudo=True))
    print("GALLERY_ENABLED=" + run(f"if test -L {shlex.quote(ENABLED_NGINX)}; then readlink -f {shlex.quote(ENABLED_NGINX)}; else echo ABSENT; fi", sudo=True))
    pending_content = run(f"if test -f {shlex.quote(PENDING_NGINX)}; then /bin/sed -n '1,220p' {shlex.quote(PENDING_NGINX)}; else true; fi", sudo=True)
    print("PENDING_CONTENT=" + pending_content.replace("\n", " | "))
    print("CERTBOT_STATUS=" + run("if command -v certbot >/dev/null 2>&1; then certbot certificates 2>&1 || true; else echo CERTBOT_NOT_INSTALLED; fi", sudo=True).replace("\n", " | "))
    print("ACME_STATUS=" + run("if command -v acme.sh >/dev/null 2>&1; then acme.sh --version 2>&1 || true; elif test -d /root/.acme.sh; then echo ROOT_ACME_DIR_PRESENT; elif test -d /home/deploy/.acme.sh; then echo DEPLOY_ACME_DIR_PRESENT; else echo ACME_CLIENT_NOT_FOUND; fi", sudo=True).replace("\n", " | "))
    print("TLS_CERT_METADATA=" + run("for cert in /etc/mychangli/tls/*.crt /etc/letsencrypt/live/*/fullchain.pem; do if test -f \"$cert\"; then /usr/bin/openssl x509 -in \"$cert\" -noout -subject -issuer -dates 2>/dev/null || true; fi; done", sudo=True).replace("\n", " | "))
    print("UFW_STATUS=" + run("if command -v ufw >/dev/null 2>&1; then ufw status 2>&1 || true; else echo UFW_NOT_INSTALLED; fi", sudo=True).replace("\n", " | "))
    print("IPTABLES_STATUS=" + run("if command -v iptables >/dev/null 2>&1; then iptables -S 2>&1 | head -80 || true; else echo IPTABLES_NOT_INSTALLED; fi", sudo=True).replace("\n", " | "))
    print("NFTABLES_STATUS=" + run("if command -v nft >/dev/null 2>&1; then nft list ruleset 2>&1 | head -120 || true; else echo NFT_NOT_INSTALLED; fi", sudo=True).replace("\n", " | "))
    print("FIREWALLD_STATUS=" + run("if command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --state 2>&1 || true; else echo FIREWALLD_NOT_INSTALLED; fi", sudo=True).replace("\n", " | "))
    print("PUBLIC_HOST_SMOKE=" + run("/usr/bin/curl -k -sS -o /dev/null -w '%{http_code} %{url_effective}' --max-time 10 -H 'Host: mychangliapp.cn' https://127.0.0.1/ || true", sudo=True))


def enable_http(run) -> None:
    created_final = False
    created_link = False
    try:
        run(f"/usr/bin/test -f {shlex.quote(PENDING_NGINX)}")
        final_state = run(f"if test -e {shlex.quote(FINAL_NGINX)} || test -L {shlex.quote(FINAL_NGINX)}; then echo PRESENT; else echo ABSENT; fi", sudo=True)
        if final_state != "ABSENT":
            raise RuntimeError(f"Refusing to overwrite existing Nginx config: {FINAL_NGINX}")
        link_state = run(f"if test -e {shlex.quote(ENABLED_NGINX)} || test -L {shlex.quote(ENABLED_NGINX)}; then readlink -f {shlex.quote(ENABLED_NGINX)} || echo PRESENT; else echo ABSENT; fi", sudo=True)
        if link_state != "ABSENT":
            raise RuntimeError(f"Refusing to overwrite existing Nginx link: {ENABLED_NGINX} -> {link_state}")
        run("/usr/sbin/nginx -t", sudo=True)
        run(f"/usr/bin/install -o root -g root -m 0644 {shlex.quote(PENDING_NGINX)} {shlex.quote(FINAL_NGINX)}", sudo=True)
        created_final = True
        run(f"/usr/bin/ln -s {shlex.quote(FINAL_NGINX)} {shlex.quote(ENABLED_NGINX)}", sudo=True)
        created_link = True
        run("/usr/sbin/nginx -t", sudo=True)
        run("/usr/bin/systemctl reload nginx", sudo=True)
        home = run("/usr/bin/curl -sS -o /dev/null -w '%{http_code} %{url_effective}' --max-time 10 -H 'Host: templates.mychangliapp.cn' http://127.0.0.1/", sudo=True)
        demo = run("/usr/bin/curl -sS -o /dev/null -w '%{http_code} %{url_effective}' --max-time 10 -H 'Host: templates.mychangliapp.cn' http://127.0.0.1/demo/mp-001/", sudo=True)
        print("HTTP_ENABLE=PASS")
        print("GALLERY_ENABLED=" + ENABLED_NGINX)
        print("HTTP_LOCAL_HOME=" + home)
        print("HTTP_LOCAL_DEMO=" + demo)
        print("HTTPS_STATUS=WAITING_FOR_DNS_AND_CERTIFICATE")
    except Exception:
        if created_link:
            try:
                run(f"/bin/rm -f -- {shlex.quote(ENABLED_NGINX)}", sudo=True)
            except Exception:
                pass
        if created_final:
            try:
                run(f"/bin/rm -f -- {shlex.quote(FINAL_NGINX)}", sudo=True)
            except Exception:
                pass
        raise


def validate_certificate(cert_path: Path, key_path: Path) -> dict[str, str]:
    if not cert_path.is_file() or not key_path.is_file():
        raise RuntimeError("Certificate or private key file is missing")
    cert_bytes = cert_path.read_bytes()
    key_bytes = key_path.read_bytes()
    try:
        certificate = x509.load_pem_x509_certificate(cert_bytes)
        private_key = serialization.load_pem_private_key(key_bytes, password=None)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Unable to parse certificate package: {exc}") from exc

    try:
        names = certificate.extensions.get_extension_for_class(x509.SubjectAlternativeName).value.get_values_for_type(x509.DNSName)
    except x509.ExtensionNotFound as exc:
        raise RuntimeError("Certificate has no Subject Alternative Name extension") from exc
    if "templates.mychangliapp.cn" not in names:
        raise RuntimeError(f"Certificate SAN does not include templates.mychangliapp.cn: {names}")

    now = datetime.now(timezone.utc)
    not_before = getattr(certificate, "not_valid_before_utc", None)
    not_after = getattr(certificate, "not_valid_after_utc", None)
    if not_before is None:
        not_before = certificate.not_valid_before.replace(tzinfo=timezone.utc)
    if not_after is None:
        not_after = certificate.not_valid_after.replace(tzinfo=timezone.utc)
    if not_before > now or not_after <= now:
        raise RuntimeError(f"Certificate is not currently valid: {not_before.isoformat()} -> {not_after.isoformat()}")
    if cert_bytes.count(b"-----BEGIN CERTIFICATE-----") < 2:
        raise RuntimeError("Certificate file does not contain a complete chain bundle")

    cert_public = certificate.public_key().public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    key_public = private_key.public_key().public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    cert_public_sha256 = hashlib.sha256(cert_public).hexdigest()
    key_public_sha256 = hashlib.sha256(key_public).hexdigest()
    if cert_public_sha256 != key_public_sha256:
        raise RuntimeError("Certificate and private key public keys do not match")

    return {
        "subject": certificate.subject.rfc4514_string(),
        "issuer": certificate.issuer.rfc4514_string(),
        "not_before": not_before.isoformat(),
        "not_after": not_after.isoformat(),
        "certificate_sha256": hashlib.sha256(cert_bytes).hexdigest(),
        "public_key_sha256": cert_public_sha256,
    }


def deploy_https(run, client, cert_path: Path, key_path: Path) -> None:
    metadata = validate_certificate(cert_path, key_path)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    remote_upload = f"/tmp/xiaoyu-template-gallery-ssl-{timestamp}-{uuid4().hex[:8]}"
    backup_dir = f"{BACKUP_PARENT}/template-gallery-ssl-{timestamp}-{uuid4().hex[:8]}"
    config_name = "templates-mychangliapp"
    remote_config = f"{remote_upload}/{config_name}"
    manifest_lines = [
        f"{sha256_file(cert_path)}  templates.mychangliapp.cn_bundle.crt",
        f"{sha256_file(key_path)}  templates.mychangliapp.cn.key",
    ]
    backup_created = False
    config_written = False
    cert_written = False
    key_written = False
    existing_cert = False
    existing_key = False
    try:
        final_state = run(f"if test -f {shlex.quote(FINAL_NGINX)}; then echo PRESENT; else echo ABSENT; fi", sudo=True)
        if final_state != "PRESENT":
            raise RuntimeError(f"Expected existing HTTP config is missing: {FINAL_NGINX}")
        link_state = run(f"if test -L {shlex.quote(ENABLED_NGINX)}; then readlink -f {shlex.quote(ENABLED_NGINX)}; else echo ABSENT; fi", sudo=True)
        if link_state != FINAL_NGINX:
            raise RuntimeError(f"Gallery Nginx link is not the expected independent vhost: {link_state}")
        run(f"/usr/bin/mkdir -p {shlex.quote(remote_upload)}")
        sftp = client.open_sftp()
        try:
            sftp.put(str(cert_path), f"{remote_upload}/templates.mychangliapp.cn_bundle.crt")
            sftp.put(str(key_path), f"{remote_upload}/templates.mychangliapp.cn.key")
            with sftp.file(f"{remote_upload}/.deployment-manifest.sha256", "w") as manifest:
                manifest.write("\n".join(manifest_lines) + "\n")
            with sftp.file(remote_config, "w") as config:
                config.write(https_nginx())
        finally:
            sftp.close()

        run(f"cd {shlex.quote(remote_upload)} && /usr/bin/sha256sum -c .deployment-manifest.sha256 >/dev/null")
        run(f"/usr/bin/mkdir -p {shlex.quote(backup_dir)} && /bin/cp -a -- {shlex.quote(FINAL_NGINX)} {shlex.quote(backup_dir + '/' + config_name)}", sudo=True)
        existing_cert = run(f"if test -e {shlex.quote(REMOTE_CERT)}; then echo PRESENT; else echo ABSENT; fi", sudo=True) == "PRESENT"
        existing_key = run(f"if test -e {shlex.quote(REMOTE_KEY)}; then echo PRESENT; else echo ABSENT; fi", sudo=True) == "PRESENT"
        if existing_cert:
            run(f"/bin/cp -a -- {shlex.quote(REMOTE_CERT)} {shlex.quote(backup_dir + '/templates.mychangliapp.cn_bundle.crt')}", sudo=True)
        if existing_key:
            run(f"/bin/cp -a -- {shlex.quote(REMOTE_KEY)} {shlex.quote(backup_dir + '/templates.mychangliapp.cn.key')}", sudo=True)
        backup_created = True

        run(f"/usr/bin/install -d -o root -g root -m 0750 {shlex.quote(CERT_DIR)}", sudo=True)
        run(f"/usr/bin/install -o root -g root -m 0644 {shlex.quote(remote_upload + '/templates.mychangliapp.cn_bundle.crt')} {shlex.quote(REMOTE_CERT)}", sudo=True)
        cert_written = True
        run(f"/usr/bin/install -o root -g root -m 0600 {shlex.quote(remote_upload + '/templates.mychangliapp.cn.key')} {shlex.quote(REMOTE_KEY)}", sudo=True)
        key_written = True
        run(f"/usr/bin/install -o root -g root -m 0644 {shlex.quote(remote_config)} {shlex.quote(FINAL_NGINX)}", sudo=True)
        config_written = True
        run("/usr/sbin/nginx -t", sudo=True)
        run("/usr/bin/systemctl reload nginx", sudo=True)

        home = run("/usr/bin/curl -k -sS --resolve templates.mychangliapp.cn:443:127.0.0.1 -o /dev/null -w '%{http_code} %{url_effective}' --max-time 15 https://templates.mychangliapp.cn/")
        demo = run("/usr/bin/curl -k -sS --resolve templates.mychangliapp.cn:443:127.0.0.1 -o /dev/null -w '%{http_code} %{url_effective}' --max-time 15 https://templates.mychangliapp.cn/demo/mp-001/")
        redirect = run("/usr/bin/curl -sS --resolve templates.mychangliapp.cn:80:127.0.0.1 -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 15 http://templates.mychangliapp.cn/")
        public_private = run(f"/usr/bin/find {shlex.quote(TARGET_ROOT)} -type f \( -name '*.key' -o -name '*.pem' -o -iname '*private*' \) -print", sudo=True)
        if public_private:
            raise RuntimeError(f"Private-looking files found in public root: {public_private}")
        print("HTTPS_DEPLOYMENT=PASS")
        print(f"CERTIFICATE_PATH={REMOTE_CERT}")
        print(f"PRIVATE_KEY_PATH={REMOTE_KEY}")
        print(f"BACKUP_DIR={backup_dir}")
        print(f"CERT_SUBJECT={metadata['subject']}")
        print(f"CERT_ISSUER={metadata['issuer']}")
        print(f"CERT_NOT_BEFORE={metadata['not_before']}")
        print(f"CERT_NOT_AFTER={metadata['not_after']}")
        print(f"CERT_SHA256={metadata['certificate_sha256']}")
        print(f"PUBLIC_KEY_SHA256={metadata['public_key_sha256']}")
        print(f"HTTPS_LOCAL_HOME={home}")
        print(f"HTTPS_LOCAL_DEMO={demo}")
        print(f"HTTP_REDIRECT={redirect}")
        print("PUBLIC_ROOT_PRIVATE_FILES=NONE")
    except Exception:
        if backup_created:
            try:
                if config_written:
                    run(f"/usr/bin/install -o root -g root -m 0644 {shlex.quote(backup_dir + '/' + config_name)} {shlex.quote(FINAL_NGINX)}", sudo=True)
                if cert_written:
                    if existing_cert:
                        run(f"/usr/bin/install -o root -g root -m 0644 {shlex.quote(backup_dir + '/templates.mychangliapp.cn_bundle.crt')} {shlex.quote(REMOTE_CERT)}", sudo=True)
                    else:
                        run(f"/bin/rm -f -- {shlex.quote(REMOTE_CERT)}", sudo=True)
                if key_written:
                    if existing_key:
                        run(f"/usr/bin/install -o root -g root -m 0600 {shlex.quote(backup_dir + '/templates.mychangliapp.cn.key')} {shlex.quote(REMOTE_KEY)}", sudo=True)
                    else:
                        run(f"/bin/rm -f -- {shlex.quote(REMOTE_KEY)}", sudo=True)
                run("/usr/sbin/nginx -t", sudo=True)
                run("/usr/bin/systemctl reload nginx", sudo=True)
            except Exception as rollback_error:  # noqa: BLE001
                print(f"HTTPS rollback failed: {rollback_error}", file=sys.stderr)
        raise
    finally:
        try:
            run(f"/bin/rm -rf -- {shlex.quote(remote_upload)}")
        except Exception:
            pass


def deploy(run, client, files: list[tuple[Path, str]]) -> None:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    remote_upload = f"/tmp/xiaoyu-template-gallery-{timestamp}-{uuid4().hex[:8]}"
    backup_dir = f"{BACKUP_PARENT}/template-gallery-{timestamp}"
    manifest_lines: list[str] = []
    deployment_started = False
    try:
        existing = run(f"if test -e {shlex.quote(TARGET_ROOT)}; then find {shlex.quote(TARGET_ROOT)} -mindepth 1 -maxdepth 1 -print -quit; else echo MISSING; fi", sudo=True)
        if existing != "MISSING":
            raise RuntimeError(f"Refusing to overwrite existing non-empty target: {existing}")
        run(f"/usr/bin/mkdir -p {shlex.quote(remote_upload)}")
        sftp = client.open_sftp()
        try:
            created_dirs = {""}
            for local_path, relative in files:
                parent = PurePosixPath(relative).parent
                current = ""
                for part in parent.parts:
                    if part == ".":
                        continue
                    current = f"{current}/{part}" if current else part
                    if current not in created_dirs:
                        sftp.mkdir(f"{remote_upload}/{current}")
                        created_dirs.add(current)
                sftp.put(str(local_path), f"{remote_upload}/{relative}")
                manifest_lines.append(f"{sha256_file(local_path)}  {relative}")
            with sftp.file(f"{remote_upload}/.deployment-manifest.sha256", "w") as manifest:
                manifest.write("\n".join(manifest_lines) + "\n")
            with sftp.file(f"{remote_upload}/templates-mychangliapp.pending", "w") as config:
                config.write(pending_nginx())
        finally:
            sftp.close()

        run(f"cd {shlex.quote(remote_upload)} && /usr/bin/sha256sum -c .deployment-manifest.sha256 >/dev/null")
        run(f"/usr/bin/mkdir -p {shlex.quote(TARGET_ROOT)} && /bin/cp -a {shlex.quote(remote_upload)}/. {shlex.quote(TARGET_ROOT)}/ && /bin/chmod -R u=rwX,go=rX {shlex.quote(TARGET_ROOT)}", sudo=True, timeout=300)
        deployment_started = True
        run(f"/usr/bin/install -o root -g root -m 0644 {shlex.quote(remote_upload + '/templates-mychangliapp.pending')} {shlex.quote(PENDING_NGINX)}", sudo=True)
        run(f"/usr/bin/test -f {shlex.quote(TARGET_ROOT + '/index.html')} && /usr/bin/test -f {shlex.quote(TARGET_ROOT + '/demo/mp-001/manifest.json')}", sudo=True)
        run("/usr/sbin/nginx -t", sudo=True)
        print("STATIC_DEPLOYMENT=PASS")
        print(f"STATIC_ROOT={TARGET_ROOT}")
        print(f"STAGED_NGINX={PENDING_NGINX}")
        print("ACTIVE_HTTPS=BLOCKED_DNS_AND_CERT")
        print(f"FILES={len(files)}")
    except Exception:
        if deployment_started:
            try:
                run(f"/bin/rm -rf -- {shlex.quote(TARGET_ROOT)}", sudo=True, timeout=300)
            except Exception as rollback_error:  # noqa: BLE001
                print(f"Cleanup after failed first deployment failed: {rollback_error}", file=sys.stderr)
        raise
    finally:
        try:
            run(f"/bin/rm -rf -- {shlex.quote(remote_upload)}")
        except Exception:
            pass


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"Gallery remote operation failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
