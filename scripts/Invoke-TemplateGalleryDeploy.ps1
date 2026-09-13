#requires -Version 5.1

[CmdletBinding()]
param(
    [ValidateSet("Inspect", "DeployStatic")]
    [string]$Action = "Inspect",
    [string]$DistPath = "",
    [string]$RuntimeRoot = "D:\Codex\01_App-应用开发\001_MyChangLi-我的长理\00_Project-项目说明\Local-Automation\runtime\backend-password-runtime"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($DistPath)) { $DistPath = Join-Path $repoRoot "dist" }
$recordPath = Join-Path $env:LOCALAPPDATA "MyChangli\Secrets\backend-key-sudo.clixml"
if (-not (Test-Path -LiteralPath $recordPath -PathType Leaf)) { throw "Backend key/sudo record is missing." }
$record = Import-Clixml -LiteralPath $recordPath
foreach ($propertyName in @("HostName", "Port", "UserName", "IdentityFile", "KeyPassphrase", "SudoPassword")) {
    if (-not $record.PSObject.Properties[$propertyName]) { throw "Credential record is missing '$propertyName'." }
}
if (-not (Test-Path -LiteralPath ([string]$record.IdentityFile) -PathType Leaf)) { throw "SSH identity file is missing." }
if (-not (Test-Path -LiteralPath $DistPath -PathType Container) -and $Action -eq "DeployStatic") { throw "Gallery dist directory is missing." }
$python = Join-Path $RuntimeRoot "venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) { throw "Established deployment Python runtime is missing." }

function Convert-SecureValueToPlainText {
    param([Parameter(Mandatory = $true)][object]$Value)
    if ($Value -is [System.Management.Automation.PSCredential]) { return $Value.GetNetworkCredential().Password }
    if ($Value -is [System.Security.SecureString]) {
        $pointer = [System.IntPtr]::Zero
        try {
            $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
            return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        } finally {
            if ($pointer -ne [System.IntPtr]::Zero) { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
        }
    }
    throw "Credential record value is invalid."
}

$envNames = @("MY_CHANGLI_BACKEND_HOST", "MY_CHANGLI_BACKEND_PORT", "MY_CHANGLI_BACKEND_USER", "MY_CHANGLI_BACKEND_IDENTITY_FILE", "MY_CHANGLI_BACKEND_KEY_PASSPHRASE", "MY_CHANGLI_BACKEND_SUDO_PASSWORD", "MY_CHANGLI_GALLERY_ACTION", "MY_CHANGLI_GALLERY_DIST")
$previous = @{}
foreach ($name in $envNames) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, "Process") }
try {
    $env:MY_CHANGLI_BACKEND_HOST = [string]$record.HostName
    $env:MY_CHANGLI_BACKEND_PORT = [string]$record.Port
    $env:MY_CHANGLI_BACKEND_USER = [string]$record.UserName
    $env:MY_CHANGLI_BACKEND_IDENTITY_FILE = [string]$record.IdentityFile
    $env:MY_CHANGLI_BACKEND_KEY_PASSPHRASE = Convert-SecureValueToPlainText -Value $record.KeyPassphrase
    $env:MY_CHANGLI_BACKEND_SUDO_PASSWORD = Convert-SecureValueToPlainText -Value $record.SudoPassword
    $env:MY_CHANGLI_GALLERY_ACTION = $Action.ToLowerInvariant()
    $env:MY_CHANGLI_GALLERY_DIST = (Resolve-Path $DistPath).Path
    & $python (Join-Path $repoRoot "deploy\remote_ops.py")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    foreach ($name in $envNames) {
        if ($null -eq $previous[$name]) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
        else { [Environment]::SetEnvironmentVariable($name, $previous[$name], "Process") }
    }
}
