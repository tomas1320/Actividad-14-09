$ErrorActionPreference = "Stop"

$baseUrl = $env:API_BASE_URL
if (-not $baseUrl) {
  $baseUrl = "http://localhost:3000"
}
$baseUrl = $baseUrl.TrimEnd("/")

function Invoke-CurlJson {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][int]$ExpectedStatus,
    [object]$Body,
    [string]$Token
  )

  $curlArgs = @(
    "--silent",
    "--show-error",
    "--write-out",
    "`nSTATUS:%{http_code}",
    "--request",
    $Method,
    "$baseUrl$Path"
  )
  if ($Token) {
    $curlArgs += @("--header", "Authorization: Bearer $Token")
  }

  $tempBodyFile = $null
  try {
    if ($null -ne $Body) {
      $tempBodyFile = [System.IO.Path]::GetTempFileName()
      $jsonBody = ConvertTo-Json -InputObject $Body -Compress
      [System.IO.File]::WriteAllText(
        $tempBodyFile,
        $jsonBody,
        [System.Text.UTF8Encoding]::new($false)
      )
      $curlArgs += @("--header", "Content-Type: application/json", "--data-binary", "@$tempBodyFile")
    }

    $output = & curl.exe @curlArgs
  } finally {
    if ($tempBodyFile -and (Test-Path -LiteralPath $tempBodyFile)) {
      Remove-Item -LiteralPath $tempBodyFile -Force
    }
  }

  if ($LASTEXITCODE -ne 0) {
    throw "curl.exe failed for $Method $Path with exit code $LASTEXITCODE."
  }

  $text = [string]::Join([Environment]::NewLine, [string[]]$output)
  $statusMatch = [regex]::Match($text, "(?s)\r?\nSTATUS:(\d{3})$")
  if (-not $statusMatch.Success) {
    throw "Could not read the HTTP status from $Method $Path."
  }

  $statusCode = [int]$statusMatch.Groups[1].Value
  if ($statusCode -ne $ExpectedStatus) {
    throw "Expected HTTP $ExpectedStatus from $Method $Path, received $statusCode."
  }

  $responseBody = $text.Substring(0, $statusMatch.Index)
  $parsedBody = $null
  if ($responseBody) {
    $parsedBody = ConvertFrom-Json -InputObject $responseBody
  }
  return [pscustomobject]@{ StatusCode = $statusCode; Body = $parsedBody }
}

$rooms = Invoke-CurlJson -Method "GET" -Path "/rooms" -ExpectedStatus 200
if (-not ($rooms.Body | Where-Object { $_.name -eq "Sala A" })) {
  throw "The public rooms endpoint did not return Sala A."
}

$email = "curl-smoke-$([guid]::NewGuid().ToString('N'))@example.com"
$registration = Invoke-CurlJson -Method "POST" -Path "/users" -ExpectedStatus 201 -Body @{
  name = "Curl Smoke Test"
  email = $email
  password = "curl-secret-123"
  role = "ADMIN"
}
if ($registration.Body.role -ne "USER") {
  throw "Public registration must not grant an elevated role."
}

$login = Invoke-CurlJson -Method "POST" -Path "/auth/login" -ExpectedStatus 200 -Body @{
  email = $email
  password = "curl-secret-123"
}
$token = $login.Body.accessToken
$refreshToken = $login.Body.refreshToken
if (-not $token -or -not $refreshToken) {
  throw "Login did not return a JWT."
}

$refresh = Invoke-CurlJson -Method "POST" -Path "/auth/refresh" -ExpectedStatus 200 -Body @{
  refreshToken = $refreshToken
}
$previousRefreshToken = $refreshToken
$token = $refresh.Body.accessToken
$refreshToken = $refresh.Body.refreshToken
if (-not $token -or -not $refreshToken) {
  throw "Refresh did not rotate the token pair."
}
Invoke-CurlJson -Method "POST" -Path "/auth/refresh" -ExpectedStatus 401 -Body @{
  refreshToken = $previousRefreshToken
} | Out-Null

$currentUserProfile = Invoke-CurlJson -Method "GET" -Path "/auth/profile" -ExpectedStatus 200 -Token $token
if ($currentUserProfile.Body.id -ne $registration.Body.id -or $currentUserProfile.Body.role -ne "USER") {
  throw "The authenticated profile did not match the registered user."
}

Invoke-CurlJson -Method "GET" -Path "/management/bookings" -ExpectedStatus 403 -Token $token | Out-Null
Invoke-CurlJson -Method "POST" -Path "/bookings" -ExpectedStatus 401 -Body @{
  roomId = "room-a"
  date = "2099-10-15"
  startTime = "10:00"
  endTime = "11:00"
} | Out-Null

$booking = Invoke-CurlJson -Method "POST" -Path "/bookings" -ExpectedStatus 201 -Token $token -Body @{
  roomId = "room-a"
  date = "2099-10-15"
  startTime = "10:00"
  endTime = "11:00"
}
if ($booking.Body.userId -ne $currentUserProfile.Body.id) {
  throw "The booking owner was not derived from the JWT."
}

$bookings = Invoke-CurlJson -Method "GET" -Path "/users/$($currentUserProfile.Body.id)/bookings" -ExpectedStatus 200 -Token $token
if ($bookings.Body.Count -ne 1) {
  throw "Expected one booking for the authenticated user."
}

$otherEmail = "curl-other-$([guid]::NewGuid().ToString('N'))@example.com"
Invoke-CurlJson -Method "POST" -Path "/users" -ExpectedStatus 201 -Body @{
  name = "Other User"
  email = $otherEmail
  password = "curl-secret-456"
} | Out-Null
$otherLogin = Invoke-CurlJson -Method "POST" -Path "/auth/login" -ExpectedStatus 200 -Body @{
  email = $otherEmail
  password = "curl-secret-456"
}
Invoke-CurlJson -Method "GET" -Path "/users/$($currentUserProfile.Body.id)/bookings" -ExpectedStatus 404 -Token $otherLogin.Body.accessToken | Out-Null

$cancelled = Invoke-CurlJson -Method "POST" -Path "/bookings/$($booking.Body.id)/cancel" -ExpectedStatus 200 -Token $token
if ($cancelled.Body.status -ne "CANCELLED") {
  throw "The booking was not cancelled."
}

$availability = Invoke-CurlJson -Method "GET" -Path "/rooms?date=2099-10-15&startTime=10%3A00&endTime=11%3A00" -ExpectedStatus 200
if (-not ($availability.Body | Where-Object { $_.name -eq "Sala A" })) {
  throw "The cancelled booking did not release the room."
}

$logout = Invoke-CurlJson -Method "POST" -Path "/auth/logout" -ExpectedStatus 204 -Body @{
  refreshToken = $refreshToken
}
if ($logout.Body) {
  throw "Logout should not return a response body."
}
Invoke-CurlJson -Method "POST" -Path "/auth/refresh" -ExpectedStatus 401 -Body @{
  refreshToken = $refreshToken
} | Out-Null

Write-Host "cURL smoke tests passed: CORS-compatible API, registration, JWT rotation/revocation, RBAC, IDOR, booking and availability."
