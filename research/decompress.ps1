# Decompress Oodle-compressed PBZ save slots (*.cmp written by slots.js) into JSON.
# Usage: powershell -File decompress.ps1 -OutDir <dir with index.json + *.cmp> -Dll <path to oo2core_8_win64.dll>
# The DLL is NOT shipped with PBZ (Oodle is statically linked). A copy usually ships with other Unreal Engine games, e.g.:
#   <Steam library>\steamapps\common\<another UE game>\Engine\Binaries\ThirdParty\Oodle\Win64\oo2core_8_win64.dll
param([Parameter(Mandatory)][string]$OutDir, [Parameter(Mandatory)][string]$Dll)

Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class Oo {
  [DllImport(@"$Dll", CallingConvention=CallingConvention.StdCall)]
  public static extern long OodleLZ_Decompress(byte[] src, long srcLen, byte[] dst, long dstLen, int fuzz, int crc, int verbose, IntPtr dstBase, long e, IntPtr cb, IntPtr cbCtx, IntPtr scratch, long scratchSize, int threadPhase);
}
"@
$idx = Get-Content (Join-Path $OutDir 'index.json') -Raw | ConvertFrom-Json
foreach ($e in $idx) {
  $src = [IO.File]::ReadAllBytes((Join-Path $OutDir "$($e.name).cmp")); $dst = New-Object byte[] $e.raw
  $n = [Oo]::OodleLZ_Decompress($src, $src.Length, $dst, $dst.Length, 1, 0, 0, [IntPtr]::Zero, 0, [IntPtr]::Zero, [IntPtr]::Zero, [IntPtr]::Zero, 0, 3)
  "$($e.name): $n / $($e.raw)"
  if ($n -eq $e.raw) { [IO.File]::WriteAllBytes((Join-Path $OutDir "$($e.name).json"), $dst) }
}
