$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = Split-Path -Parent $PSScriptRoot
$siteRoot = Join-Path $projectRoot 'solid-site'
$archivePath = Join-Path $projectRoot 'solid-site-dokploy.zip'
$rootFiles = @('package.json', 'package-lock.json', 'tsconfig.json', 'index.html', 'vite.config.js', 'Dockerfile', 'nginx.conf', '.dockerignore', '.gitignore', 'README.md', 'playwright.config.js')
$files = @($rootFiles | ForEach-Object { Get-Item -LiteralPath (Join-Path $siteRoot $_) })
foreach ($folder in @('src', 'public', 'e2e')) {
    $files += Get-ChildItem -LiteralPath (Join-Path $siteRoot $folder) -Recurse -File
}

$stream = [IO.File]::Open($archivePath, [IO.FileMode]::Create)
try {
    $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $files) {
            $entry = $file.FullName.Substring($siteRoot.Length + 1).Replace('\', '/')
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entry, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally { $archive.Dispose() }
} finally { $stream.Dispose() }
Get-Item -LiteralPath $archivePath | Select-Object FullName, Length
