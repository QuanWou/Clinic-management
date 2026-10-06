function Start-RealIdentity {
 param($taskRoot,$evidence,$ports,$databasePort,$password,$PostgresBin,$userSecret)
 # Override every connection setting before launching the unchanged legacy service.
 # Its migration and runtime are confined to the fresh, loopback-only sandbox.
 $settings=@{SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:$databasePort/clinic_v2_s6_auth_sandbox";SPRING_DATASOURCE_USERNAME='s6_auth_verify';SPRING_DATASOURCE_PASSWORD=$password;SPRING_FLYWAY_ENABLED='true';SPRING_FLYWAY_USER='postgres';SPRING_FLYWAY_PASSWORD=$password;SPRING_FLYWAY_DEFAULT_SCHEMA='identity';SPRING_FLYWAY_SCHEMAS='identity';SERVER_PORT="$($ports.legacy)";SERVER_ADDRESS='127.0.0.1';APP_SECURITY_JWT_SECRET=$userSecret;SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE='4';SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE='1'}
  $jar=Join-Path $taskRoot 'backend/auth-service/target/identity-service-1.0.0-SNAPSHOT.jar'
  if(-not (Test-Path -LiteralPath $jar)){throw 'Build the unchanged legacy Identity package before the authenticated flow'}
  $child=Start-Process java.exe -Environment $settings -ArgumentList @('-Xmx256m','-jar',('"'+$jar+'"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $evidence 'real-auth-flow.txt') -RedirectStandardError (Join-Path $evidence 'real-auth-flow.stderr')
 return $child
}
function Invoke-RealIdentityRegistration {
 param($evidence,$ports)
 $url="http://127.0.0.1:$($ports.legacy)/api/auth";$users=@{};$authTokens=@{};$patientRoles=@{};$accounts=@{}
 foreach($name in @('owner','reception','doctor','stranger','unassigned')){
  $email="synthetic-s6-$name-$([guid]::NewGuid().ToString('N'))@example.invalid";$password='Synthetic-S6-'+[guid]::NewGuid().ToString('N')
  $body=@{email=$email;password=$password;fullName="Synthetic S6 $name"}
  $registered=Post "$url/register" @{} $body
  $login=Post "$url/login" @{} @{email=$email;password=$password}
  if(-not $registered.success -or -not $login.success -or $registered.data.userId -ne $login.data.userId -or -not $login.data.accessToken){throw 'Actual signup/login did not return the same authenticated user'}
  $me=Invoke-RestMethod "http://127.0.0.1:$($ports.legacy)/api/users/me" -Headers @{Authorization="Bearer $($login.data.accessToken)"}
  if($me.data.id -ne $login.data.userId -or $me.data.status -ne 'ACTIVE'){throw 'Legacy current-user source does not match signup/login'}
  $users[$name]=$me.data.id;$authTokens[$name]=$login.data.accessToken;$patientRoles[$name]=@($me.data.roles)
  $accounts[$name]=@{email=$email;password=$password}
  $duplicate=Invoke-WebRequest "$url/register" -Method Post -ContentType 'application/json' -Body ($body|ConvertTo-Json) -SkipHttpErrorCheck
  if($duplicate.StatusCode -ne 409){throw 'Actual duplicate signup was not rejected'}
  $refreshDenied=Invoke-WebRequest "http://127.0.0.1:$($ports.legacy)/api/users/me" -Headers @{Authorization="Bearer $($login.data.refreshToken)"} -SkipHttpErrorCheck
  if($refreshDenied.StatusCode -ne 401){throw 'Refresh token entered a user-current route'}
 }
 @{status='PASS';accounts=5;registration='actual-legacy-register';login='actual-password-login-current-user-match';duplicateEmail=409;refreshAsAccess=401;legacyRoles='registered-default-Patient-not-tenant-authority';database='isolated-clinic_v2_s6_auth_sandbox';credentials='synthetic-not-retained-in-evidence';v1Source='unchanged'}|ConvertTo-Json|Set-Content (Join-Path $evidence 'real-auth-summary.json')
 return @{users=$users;tokens=$authTokens;accounts=$accounts}
}

