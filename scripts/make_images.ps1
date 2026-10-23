param([string]$OutDir)
# 共有用の画像（og.png 1200x630）とアイコン（icon-180.png）を作る
# 使い方: powershell -File scripts/make_images.ps1 -OutDir src/assets
Add-Type -AssemblyName System.Drawing

function New-Brush([string]$hex) { return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex)) }
function RoundRect([System.Drawing.Graphics]$g, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure(); $g.FillPath($brush, $p); $p.Dispose()
}
function Building([System.Drawing.Graphics]$g, $brush, [float]$x, [float]$y, [float]$k) {
  # 役所の建物（favicon.svg と同じ形。64x64 の座標を k 倍）
  $pts = @((New-Object System.Drawing.PointF(($x + 32 * $k), ($y + 11 * $k))), (New-Object System.Drawing.PointF(($x + 52 * $k), ($y + 21 * $k))), (New-Object System.Drawing.PointF(($x + 12 * $k), ($y + 21 * $k))))
  $g.FillPolygon($brush, $pts)
  RoundRect $g $brush ($x + 14 * $k) ($y + 23 * $k) (36 * $k) (4 * $k) (1.5 * $k)
  foreach ($cx in @(17, 29.5, 42)) { RoundRect $g $brush ($x + $cx * $k) ($y + 29 * $k) (5 * $k) (16 * $k) (1.5 * $k) }
  RoundRect $g $brush ($x + 11 * $k) ($y + 47 * $k) (42 * $k) (5 * $k) (2 * $k)
}
$fontName = 'Yu Gothic UI'
$installed = (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }
if (-not ($installed -contains $fontName)) { $fontName = 'Meiryo' }

# ---- OGP 1200x630 ----
$bmp = New-Object System.Drawing.Bitmap 1200, 630
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#f5f6f2'))
$teal = New-Brush '#155e63'; $ink = New-Brush '#1b2428'; $muted = New-Brush '#5b676c'; $white = New-Brush '#ffffff'; $line = New-Brush '#dfe3dc'; $bar = New-Brush '#9cc9c4'; $gold = New-Brush '#f2b45a'
$g.FillRectangle($teal, 0, 0, 1200, 14)

$fTitle = New-Object System.Drawing.Font($fontName, 88, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fSub = New-Object System.Drawing.Font($fontName, 36, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fSmall = New-Object System.Drawing.Font($fontName, 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fKey = New-Object System.Drawing.Font($fontName, 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

$g.DrawString('役所の年収しらべ', $fTitle, $ink, 60, 92)
$g.DrawString('市役所・県庁・町村役場の', $fSub, $muted, 68, 232)
$g.DrawString('年収・給料・ボーナスを比べる', $fSub, $muted, 68, 282)
RoundRect $g (New-Brush "#d9ecea") 68 368 478 56 28
$g.DrawString('全国1,788自治体・無料・登録なし', $fKey, $teal, 90, 378)
$g.DrawString('micoficial.github.io/yakusho-nenshu', $fSmall, $muted, 70, 540)

# ランキングの絵
RoundRect $g $line 736 70 404 492 26
RoundRect $g $white 732 64 404 492 26
Building $g $teal 760 82 1.1
$g.DrawString('年収ランキング', $fKey, $ink, 840, 104)
$g.FillRectangle($ink, 764, 166, 340, 3)
$ws = @(300, 262, 228, 196, 160)
$y = 192
for ($i = 0; $i -lt 5; $i++) {
  $g.DrawString(("{0}位" -f ($i + 1)), $fSmall, $muted, 764, ($y + 8))
  RoundRect $g $bar 840 ($y + 14) ($ws[$i] * 0.85) 30 10
  if ($i -eq 0) { RoundRect $g $gold 840 ($y + 14) ($ws[$i] * 0.85) 30 10 }
  $g.FillRectangle($line, 764, ($y + 66), 340, 2)
  $y += 70
}
$bmp.Save((Join-Path $OutDir 'og.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

# ---- アイコン 180x180 ----
$s = 180
$bmp = New-Object System.Drawing.Bitmap $s, $s
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#155e63'))
$k = $s / 64
Building $g $white 0 0 $k
$g.FillEllipse($gold, (40 * $k), (40 * $k), (18 * $k), (18 * $k))
$fYen = New-Object System.Drawing.Font('Arial', (12 * $k), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$sf = New-Object System.Drawing.StringFormat; $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
$g.DrawString([string][char]0x00A5, $fYen, $teal, (New-Object System.Drawing.RectangleF((40 * $k), (40.5 * $k), (18 * $k), (18 * $k))), $sf)
$bmp.Save((Join-Path $OutDir 'icon-180.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"font=$fontName"
