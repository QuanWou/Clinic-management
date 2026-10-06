param([switch]$Apply,[string]$ArchiveRoot)
$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$workspacePrefix = $workspace + [IO.Path]::DirectorySeparatorChar
if (!$ArchiveRoot) { $ArchiveRoot = Join-Path (Split-Path $workspace) 'Clinic-management-archives/2026-10-02-academic' }
$archiveDirectory = [IO.Path]::GetFullPath($ArchiveRoot)
if ($archiveDirectory.StartsWith($workspacePrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Archive must be outside the working tree' }
Push-Location $workspace
try {
    $tracked = ((& git -c core.quotepath=false ls-files -z) -join "`n").Split([char]0,[StringSplitOptions]::RemoveEmptyEntries)
    $selected = @($tracked | Where-Object {
        ($_ -like 'docs/audits/clinic-v2/*' -and ($_ -match '\.(txt|stderr)$' -or $_ -match '/source-manifest\.json$')) -or
        ($_ -like 'backend/iam-service/*' -and $_ -ne 'backend/iam-service/README.md') -or
        $_ -eq 'frontend/src/shells/PlatformShell.tsx'
    } | Where-Object { Test-Path -LiteralPath (Join-Path $workspace $_) -PathType Leaf })
    $records = @($selected | ForEach-Object {
        $absolute = [IO.Path]::GetFullPath((Join-Path $workspace $_))
        if (!$absolute.StartsWith($workspacePrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'File escaped workspace' }
        [pscustomobject]@{path=$_;absolute=$absolute;sha256=(Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash;bytes=(Get-Item -LiteralPath $absolute).Length}
    })
    if (!$Apply) { [pscustomobject]@{mode='PREVIEW';files=$records.Count;bytes=($records.bytes | Measure-Object -Sum).Sum;archiveDirectory=$archiveDirectory} | ConvertTo-Json; return }
    if (!$records.Count) { throw 'No historical files selected' }
    New-Item -ItemType Directory -Path $archiveDirectory -Force | Out-Null
    $zipPath = Join-Path $archiveDirectory 'historical-evidence-and-superseded-source.zip'
    if (Test-Path -LiteralPath $zipPath) { throw 'Existing archive must not be overwritten' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::Open($zipPath,[IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($record in $records) { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$record.absolute,$record.path,[IO.Compression.CompressionLevel]::Optimal) | Out-Null }
        # Preserve original historical reports before updating their links.
        foreach ($report in $tracked | Where-Object { $_ -like 'docs/audits/clinic-v2/*.md' }) {
            if (Test-Path -LiteralPath (Join-Path $workspace $report)) { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $workspace $report),$report,[IO.Compression.CompressionLevel]::Optimal) | Out-Null }
        }
    } finally { $zip.Dispose() }
    $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        foreach ($record in $records) {
            $entry = $zip.GetEntry($record.path)
            if (!$entry -or $entry.Length -ne $record.bytes) { throw 'Archive entry length mismatch' }
            $stream = $entry.Open(); $hash = [Security.Cryptography.SHA256]::Create()
            try { $actual = [Convert]::ToHexString($hash.ComputeHash($stream)) } finally { $hash.Dispose(); $stream.Dispose() }
            if ($actual -ne $record.sha256) { throw 'Archive SHA256 mismatch' }
        }
    } finally { $zip.Dispose() }
    $zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
    $index = [ordered]@{createdAt=[DateTimeOffset]::UtcNow.ToString('o');archive=$zipPath;sha256=$zipHash;files=@($records | Select-Object path,sha256,bytes)}
    [IO.File]::WriteAllText((Join-Path $archiveDirectory 'index.json'),($index | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
    # File-by-file deletion only after independent archive verification.
    foreach ($record in $records) {
        $absolute = [IO.Path]::GetFullPath($record.absolute)
        if (!$absolute.StartsWith($workspacePrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Deletion escaped workspace' }
        if ((Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash -ne $record.sha256) { throw 'Source changed during archival' }
        Remove-Item -LiteralPath $absolute
    }
    $archiveNote = Join-Path $workspace 'docs/audits/clinic-v2/ARCHIVE.md'
    $zipLink = $zipPath.Replace('\','/')
    $body = @"
# Historical evidence archive — 02/10/2026

Old raw test/build output, source manifests and superseded source were moved out of the working tree after SHA256 verification. Current reports, summaries, test source and the role UI audit remain in the repository.

- [Verified archive](<$zipLink>)
- Archive SHA256: ``$zipHash``
- Archived working files: $($records.Count)
- The adjacent ``index.json`` lists every original path, byte count and SHA256.
- Original historical Markdown reports are also copied into the archive.

## Historical evidence

Links redirected here refer to their original path inside the archive. These results describe the source before the four-role reduction; they do not certify the current source. Extract to a separate directory to inspect or recover files. Git history has not been rewritten.
"@
    [IO.File]::WriteAllText($archiveNote,$body,[Text.UTF8Encoding]::new($false))
    $removed = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($record in $records) { $removed.Add($record.absolute) | Out-Null }
    $allMarkdown = @($tracked | Where-Object { $_ -like '*.md' -and (Test-Path -LiteralPath (Join-Path $workspace $_)) })
    foreach ($relative in $allMarkdown) {
        $absolute = Join-Path $workspace $relative
        $text = [IO.File]::ReadAllText($absolute)
        $replacement = [regex]::Replace($text,'\]\(([^)]+)\)',{
            param($match)
            $target = $match.Groups[1].Value.Trim('<','>')
            if ($target -match '^[a-z]+://' -or $target.StartsWith('#')) { return $match.Value }
            $target = ($target -split '#')[0]
            try { $resolved = [IO.Path]::GetFullPath((Join-Path (Split-Path $absolute) $target)) } catch { return $match.Value }
            if (!$removed.Contains($resolved)) { return $match.Value }
            $link = [IO.Path]::GetRelativePath((Split-Path $absolute),$archiveNote).Replace('\','/')
            return '](' + $link + '#historical-evidence)'
        })
        if ($replacement -ne $text) { [IO.File]::WriteAllText($absolute,$replacement,[Text.UTF8Encoding]::new($false)) }
    }
    [pscustomobject]@{status='ARCHIVED_VERIFIED';files=$records.Count;archive=$zipPath;sha256=$zipHash} | ConvertTo-Json
} finally { Pop-Location }
