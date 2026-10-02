param(
  [string]$Registry = (Join-Path $PSScriptRoot 'fixture-registry.json')
)
$ErrorActionPreference='Stop'
$data = Get-Content -LiteralPath $Registry -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $data.synthetic) { throw 'Fixture registry must be explicitly synthetic.' }
$errors = New-Object System.Collections.Generic.List[string]
function Check-Node($node, $path) {
  if ($null -eq $node) { return }
  if ($node -is [System.Management.Automation.PSCustomObject]) {
    $props = @($node.PSObject.Properties)
    if ($props.Name -contains 'name' -and [string]$node.name -notmatch '^SYNTHETIC ') {
      $errors.Add("$path.name must start with SYNTHETIC")
    }
    foreach($p in $props) {
      if ($p.Name -match '(email|phone|address|license|diagnosis|clinical|national|insurance)') {
        $errors.Add("$path contains forbidden real-data-shaped property: $($p.Name)")
      }
      Check-Node $p.Value "$path.$($p.Name)"
    }
    return
  }
  if ($node -is [System.Collections.IEnumerable] -and -not ($node -is [string])) {
    $i=0; foreach($item in $node){ Check-Node $item "$path[$i]"; $i++ }
  }
}
Check-Node $data '$'
if ($errors.Count -gt 0) { throw ($errors -join [Environment]::NewLine) }
"VALID synthetic fixture registry version=$($data.version)"
