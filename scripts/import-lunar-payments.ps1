param([string]$SourceRoot='C:\xampp\htdocs\lunar-ecommerce',[string]$ConfigPath='',[string]$BankAccountName='')
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if(-not $ConfigPath){$ConfigPath=Join-Path $taskRoot '.runtime/main/config.json'}
$taskConfig=Get-Content -LiteralPath $ConfigPath -Raw|ConvertFrom-Json -AsHashtable
if(-not $taskConfig.clinic){throw 'Bind the operating clinic before importing payment configuration.'}
$taskSource=[IO.Path]::GetFullPath((Join-Path $SourceRoot '.env'))
$taskAllowed=@('PAYOS_CLIENT_ID','PAYOS_API_KEY','PAYOS_CHECKSUM_KEY','PAYOS_BASE_URL','VNPAY_TMN_CODE','VNPAY_HASH_SECRET','VNPAY_URL','BANK_TRANSFER_BANK_CODE','BANK_TRANSFER_BANK_NAME','BANK_TRANSFER_ACCOUNT_NUMBER','BANK_TRANSFER_ACCOUNT_NAME')
$taskPayments=@{}
foreach($taskLine in [IO.File]::ReadAllLines($taskSource)){
 if($taskLine -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$' -and $Matches[1] -in $taskAllowed){
  $taskKey=$Matches[1];$taskValue=$Matches[2].Trim()
  if($taskValue.Length -ge 2 -and (($taskValue.StartsWith('"') -and $taskValue.EndsWith('"')) -or ($taskValue.StartsWith("'") -and $taskValue.EndsWith("'")))){$taskValue=$taskValue.Substring(1,$taskValue.Length-2)}
  elseif($taskValue -match '^(.*?)\s+#'){$taskValue=$Matches[1]}
  if($taskValue){$taskPayments[$taskKey]=$taskValue}
 }
}
if($BankAccountName){$taskPayments.BANK_TRANSFER_ACCOUNT_NAME=$BankAccountName.Trim()}
foreach($taskKey in @('PAYOS_CLIENT_ID','PAYOS_API_KEY','PAYOS_CHECKSUM_KEY','VNPAY_TMN_CODE','VNPAY_HASH_SECRET')){if(-not $taskPayments[$taskKey]){throw "Missing $taskKey in source configuration"}}
$taskPayments.CLINIC_PAYMENTS_ENABLED='true';$taskPayments.CLINIC_PAYMENTS_CLINIC_ID=$taskConfig.clinic
$taskPayments.CLINIC_PAYMENTS_PUBLIC_URL="http://127.0.0.1:$($taskConfig.ports.web)"
$taskConfig.payments=$taskPayments
$taskConfig|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $ConfigPath -Encoding utf8
Write-Host 'Imported payment configuration into ignored server runtime configuration. No credentials printed.'
if(-not $taskPayments.BANK_TRANSFER_ACCOUNT_NAME){Write-Host 'Manual bank QR remains unavailable until the beneficiary account name is provided.'}
