# Run this from your project root (where src/ already exists)
# Usage: .\create-structure.ps1

$base = "src"

$folders = @(
    "$base\app\(tabs)"

    "$base\features\feed\components"
    "$base\features\feed\services"
    "$base\features\rooms\components"
    "$base\features\rooms\services"
    "$base\features\bluff\components"
    "$base\features\bluff\hooks"
    "$base\features\bluff\theme"
    "$base\features\chess\components"
    "$base\features\battle\components"
    "$base\features\communities\components"
    "$base\features\communities\services"
    "$base\features\dm\components"
    "$base\features\dm\services"
    "$base\features\trade\components"
    "$base\features\avatar\components"
    "$base\features\avatar\hooks"
    "$base\features\avatar\services"
    "$base\features\avatar\utils"
    "$base\features\missions\components"
    "$base\features\missions\hooks"
    "$base\features\legal\components"
    "$base\features\legal\content"

    "$base\shared\components\motion"
    "$base\shared\hooks"
    "$base\shared\services"
    "$base\shared\utils"
    "$base\shared\constants"
    "$base\shared\config"

    "$base\assets\frame"
)

foreach ($folder in $folders) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
}

Write-Host "Folder structure ban gaya!" -ForegroundColor Green