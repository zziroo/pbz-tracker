# Reference Oodle decompressor (DLL via P/Invoke), used only by test/oodle-compare.js. Reads/writes only inside -Dir (a temp folder).
# Input: <Dir>\index.json = [{ "file": "x.cmp", "raw": <size>, "out": "x.bin" }, ...]
# The DLL is used in place (from another game's folder); it is never copied.
param([Parameter(Mandatory)][string]$Dir, [Parameter(Mandatory)][string]$Dll)
$ErrorActionPreference = 'Stop'
$dllEsc = $Dll.Replace('"', '""')
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class PbzOodle {
  [DllImport(@"$dllEsc", CallingConvention=CallingConvention.StdCall)]
  public static extern long OodleLZ_Decompress(byte[] src, long srcLen, byte[] dst, long dstLen, int fuzz, int crc, int verbose, IntPtr dstBase, long e, IntPtr cb, IntPtr cbCtx, IntPtr scratch, long scratchSize, int threadPhase);
}
"@
$idx = Get-Content -LiteralPath (Join-Path $Dir 'index.json') -Raw | ConvertFrom-Json
$bad = 0
foreach ($e in $idx) {
  $src = [IO.File]::ReadAllBytes((Join-Path $Dir $e.file))
  $dst = New-Object byte[] ([int]$e.raw)
  $n = [PbzOodle]::OodleLZ_Decompress($src, $src.Length, $dst, $dst.Length, 1, 0, 0, [IntPtr]::Zero, 0, [IntPtr]::Zero, [IntPtr]::Zero, [IntPtr]::Zero, 0, 3)
  if ($n -eq [long]$e.raw) { [IO.File]::WriteAllBytes((Join-Path $Dir $e.out), $dst) } else { $bad++; [Console]::Error.WriteLine("$($e.file): $n / $($e.raw)") }
}
exit $bad
