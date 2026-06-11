param(
    [Parameter(Mandatory = $true)][string]$File,
    [int]$ReadTimeoutMs = 60000
)

$code = [System.IO.File]::ReadAllText($File)
$client = New-Object System.Net.Sockets.TcpClient
$client.Connect("127.0.0.1", 5000)
$stream = $client.GetStream()
$stream.ReadTimeout = $ReadTimeoutMs

$payload = $code + "`n##END##`n"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
$stream.Write($bytes, 0, $bytes.Length)

$buf = New-Object byte[] 1048576
$response = ""
try {
    $n = $stream.Read($buf, 0, $buf.Length)
    if ($n -gt 0) {
        $response = [System.Text.Encoding]::UTF8.GetString($buf, 0, $n)
        # keep reading briefly in case the response spans packets (tracebacks)
        $stream.ReadTimeout = 500
        while ($true) {
            try {
                $n = $stream.Read($buf, 0, $buf.Length)
                if ($n -le 0) { break }
                $response += [System.Text.Encoding]::UTF8.GetString($buf, 0, $n)
            } catch { break }
        }
    }
} catch {
    $response = "NO RESPONSE (timeout after ${ReadTimeoutMs}ms)"
}
$client.Close()
Write-Output $response.TrimEnd()
