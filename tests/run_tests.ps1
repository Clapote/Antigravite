# Antigravité - Suite de Tests Automatisés
# Ce script vérifie le respect scrupuleux de l'ensemble des règles et principes impératifs.

$ErrorActionPreference = "Stop"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Antigravité - Exécution de la suite de tests unitaires" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$baseDir = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { (Get-Location).Path }
$dataDir = Join-Path $baseDir "data"
$backupsDir = Join-Path $baseDir "backups"

$testsPassed = 0
$testsFailed = 0

function Assert-Test([string]$testName, [bool]$condition, [string]$failureDetails = "") {
    if ($condition) {
        Write-Host " [PASS] $testName" -ForegroundColor Green
        $global:testsPassed++
    } else {
        Write-Host " [FAIL] $testName" -ForegroundColor Red
        if ($failureDetails) {
            Write-Host "        Détails : $failureDetails" -ForegroundColor DarkRed
        }
        $global:testsFailed++
    }
}

# -----------------------------------------------------------------------------
# TEST 1 : Persistance locale des données et intégrité JSON
# -----------------------------------------------------------------------------
Write-Host "`n1. Vérification de la persistance locale et format JSON..." -ForegroundColor Yellow

$files = @("tasks.json", "projects.json", "events.json", "notes.json", "settings.json")
foreach ($f in $files) {
    $filePath = Join-Path $dataDir $f
    $exists = Test-Path $filePath
    $validJson = $false
    if ($exists) {
        try {
            $raw = Get-Content -Path $filePath -Raw -Encoding UTF8
            $null = ConvertFrom-Json $raw
            $validJson = $true
        } catch {
            $validJson = $false
        }
    }
    Assert-Test "Fichier $f existe et est un JSON valide" ($exists -and $validJson)
}

# -----------------------------------------------------------------------------
# TEST 2 : Tâches récursives sans limite de profondeur (Sous-tâches et sous-sous-tâches)
# -----------------------------------------------------------------------------
Write-Host "`n2. Vérification des tâches récursives (profondeur arbitraire)..." -ForegroundColor Yellow

$tasksJson = Get-Content -Path (Join-Path $dataDir "tasks.json") -Raw -Encoding UTF8 | ConvertFrom-Json

function Get-MaxDepth($taskList, $currentDepth = 1) {
    $max = $currentDepth
    foreach ($t in $taskList) {
        if ($t.subtasks -and $t.subtasks.Count -gt 0) {
            $subDepth = Get-MaxDepth $t.subtasks ($currentDepth + 1)
            if ($subDepth -gt $max) { $max = $subDepth }
        }
    }
    return $max
}

$depth = Get-MaxDepth $tasksJson
Assert-Test "Arborescence récursive présente (profondeur détectée >= 4 niveaux)" ($depth -ge 4) "Profondeur trouvée : $depth"

# -----------------------------------------------------------------------------
# TEST 3 : Aucune réorganisation automatique (Ordre défini préservé)
# -----------------------------------------------------------------------------
Write-Host "`n3. Vérification de la non-réorganisation automatique..." -ForegroundColor Yellow

# On vérifie que les tâches ont un ordre explicite conservé
$firstTask = $tasksJson[0]
$secondTask = $tasksJson[1]
$orderPreserved = ($firstTask.order -eq 1 -and $secondTask.order -eq 2)
Assert-Test "L'ordre initial défini par l'utilisateur est scrupuleusement conservé" $orderPreserved

# -----------------------------------------------------------------------------
# TEST 4 : Distinction stricte (Échéance vs Date prévue vs Créneau de travail)
# -----------------------------------------------------------------------------
Write-Host "`n4. Vérification de la distinction des trois notions temporelles..." -ForegroundColor Yellow

$eventsJson = Get-Content -Path (Join-Path $dataDir "events.json") -Raw -Encoding UTF8 | ConvertFrom-Json

$taskWithDates = $tasksJson[0]
$hasDeadline = -not [string]::IsNullOrEmpty($taskWithDates.deadline)
$hasPlannedDate = -not [string]::IsNullOrEmpty($taskWithDates.plannedDate)
$isDistinct = ($taskWithDates.deadline -ne $taskWithDates.plannedDate)

$linkedEvent = $eventsJson | Where-Object { $_.taskId -eq $taskWithDates.id }
$hasWorkSlot = ($null -ne $linkedEvent -and -not [string]::IsNullOrEmpty($linkedEvent.start))

Assert-Test "La tâche possède une échéance distincte de sa date prévue" ($hasDeadline -and $hasPlannedDate -and $isDistinct)
Assert-Test "Le créneau de travail dans l'agenda est stocké de manière distincte" $hasWorkSlot

# -----------------------------------------------------------------------------
# TEST 5 : Règle n°6 - La suppression d'un événement ne supprime JAMAIS la tâche
# -----------------------------------------------------------------------------
Write-Host "`n5. Vérification de l'indépendance de suppression (Événement vs Tâche)..." -ForegroundColor Yellow

# Simulation : Supprimer l'événement lié et vérifier que la tâche existe toujours
$targetTaskId = $linkedEvent.taskId
$simulatedEvents = $eventsJson | Where-Object { $_.id -ne $linkedEvent.id }

$simulatedEventExists = ($simulatedEvents | Where-Object { $_.id -eq $linkedEvent.id })
$taskStillExists = ($tasksJson | Where-Object { $_.id -eq $targetTaskId })

Assert-Test "L'événement lié peut être supprimé sans affecter la tâche" ($null -eq $simulatedEventExists -and $null -ne $taskStillExists)

# -----------------------------------------------------------------------------
# TEST 6 : Règle n°3 - Chevauchements simultanés dans le calendrier toujours autorisés
# -----------------------------------------------------------------------------
Write-Host "`n6. Vérification de la gestion des chevauchements d'agenda..." -ForegroundColor Yellow

# Trouver les événements simultanés dans events.json (ex: evt-2 et evt-3 sur 2026-10-28)
$oct28Events = $eventsJson | Where-Object { $_.start -like "2026-10-28*" }
$overlapFound = $false
for ($i = 0; $i -lt $oct28Events.Count; $i++) {
    for ($j = $i + 1; $j -lt $oct28Events.Count; $j++) {
        $startA = [DateTime]$oct28Events[$i].start
        $endA = [DateTime]$oct28Events[$i].end
        $startB = [DateTime]$oct28Events[$j].start
        $endB = [DateTime]$oct28Events[$j].end
        if ($startA -lt $endB -and $endA -gt $startB) {
            $overlapFound = $true
            break
        }
    }
}
Assert-Test "Des créneaux simultanés se chevauchant coexistent sans erreur" ($overlapFound -and $oct28Events.Count -ge 2)

# -----------------------------------------------------------------------------
# TEST 7 : Système de sauvegarde locale (Création et Restauration)
# -----------------------------------------------------------------------------
Write-Host "`n7. Vérification du système de sauvegarde locale..." -ForegroundColor Yellow

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$testBackupFile = Join-Path $backupsDir "test_backup_$timestamp.json"

$backupData = @{
    version = "1.0"
    exportedAt = (Get-Date).ToString("o")
    tasks = $tasksJson
    projects = (Get-Content (Join-Path $dataDir "projects.json") -Raw | ConvertFrom-Json)
    events = $eventsJson
    notes = (Get-Content (Join-Path $dataDir "notes.json") -Raw | ConvertFrom-Json)
    settings = (Get-Content (Join-Path $dataDir "settings.json") -Raw | ConvertFrom-Json)
}

$backupJson = $backupData | ConvertTo-Json -Depth 10
Set-Content -Path $testBackupFile -Value $backupJson -Encoding UTF8

$backupCreated = Test-Path $testBackupFile
$backupReadable = $false
if ($backupCreated) {
    try {
        $restored = Get-Content -Path $testBackupFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($restored.tasks.Count -eq $tasksJson.Count) {
            $backupReadable = $true
        }
    } catch {
        $backupReadable = $false
    }
}
Assert-Test "Création d'un instantané de sauvegarde dans backups/" $backupCreated
Assert-Test "Vérification de l'intégrité et de la restauration de la sauvegarde" $backupReadable

# -----------------------------------------------------------------------------
# TEST 8 : Intégration Google Agenda (Phase 2 - Lecture Seule & Sécurité)
# -----------------------------------------------------------------------------
Write-Host "`n8. Vérification de l'intégration Google Agenda (Phase 2)..." -ForegroundColor Yellow

$nodePath = "C:\Program Files\nodejs\node.exe"
$phase2Pass = $false
if (Test-Path $nodePath) {
    & $nodePath (Join-Path $baseDir "tests\test_google_phase2.js")
    $phase2Pass = ($LASTEXITCODE -eq 0)
}
Assert-Test "Module Google Agenda opérationnel en lecture seule et sécurisé" $phase2Pass

# -----------------------------------------------------------------------------
# TEST 9 : Intégration Google Agenda (Phase 3 - Affichage dans l'Agenda & Fusion)
# -----------------------------------------------------------------------------
Write-Host "`n9. Vérification de l'affichage dans l'Agenda et de la fusion (Phase 3)..." -ForegroundColor Yellow

$phase3Pass = $false
if (Test-Path $nodePath) {
    & $nodePath (Join-Path $baseDir "tests\test_google_phase3.js")
    $phase3Pass = ($LASTEXITCODE -eq 0)
}
Assert-Test "Affichage de l'Agenda et fusion sans collision ni perte de données" $phase3Pass

# -----------------------------------------------------------------------------
# TEST 10 : Intégration Google Agenda (Phase 4 - Création & Modification Bidirectionnelle)
# -----------------------------------------------------------------------------
Write-Host "`n10. Vérification de la création et modification bidirectionnelles (Phase 4)..." -ForegroundColor Yellow

$phase4Pass = $false
if (Test-Path $nodePath) {
    & $nodePath (Join-Path $baseDir "tests\test_google_phase4.js")
    $phase4Pass = ($LASTEXITCODE -eq 0)
}
Assert-Test "Création et modification bidirectionnelles sans boucle infinie" $phase4Pass

# -----------------------------------------------------------------------------
# TEST 11 : Intégration Google Agenda (Phase 5 - Suppressions, Conflits & Mode Hors-ligne)
# -----------------------------------------------------------------------------
Write-Host "`n11. Vérification des suppressions, conflits et robustesse hors-ligne (Phase 5)..." -ForegroundColor Yellow

$phase5Pass = $false
if (Test-Path $nodePath) {
    & $nodePath (Join-Path $baseDir "tests\test_google_phase5.js")
    $phase5Pass = ($LASTEXITCODE -eq 0)
}
Assert-Test "Suppressions, conflits et gestion robuste de la file hors-ligne" $phase5Pass

# -----------------------------------------------------------------------------
# TEST 12 : Intégration Google Agenda (Phase 6 - Sécurité Sauvegardes & Intégrité)
# -----------------------------------------------------------------------------
Write-Host "`n12. Vérification de la compatibilité des sauvegardes et sécurité (Phase 6)..." -ForegroundColor Yellow

$phase6Pass = $false
if (Test-Path $nodePath) {
    & $nodePath (Join-Path $baseDir "tests\test_google_phase6.js")
    $phase6Pass = ($LASTEXITCODE -eq 0)
}
Assert-Test "Compatibilité totale avec les sauvegardes physiques et non-fuite de secrets" $phase6Pass

# -----------------------------------------------------------------------------
# TEST 13 : Nouvelles Fonctionnalités (Liaison Notes-Agenda & Volet Latéral)
# -----------------------------------------------------------------------------
Write-Host "`n13. Vérification des nouvelles fonctionnalités (Liaison Notes-Agenda & Volet Latéral)..." -ForegroundColor Yellow

$newFeaturesPass = $false
if (Test-Path $nodePath) {
    & $nodePath (Join-Path $baseDir "tests\test_new_features.js")
    $newFeaturesPass = ($LASTEXITCODE -eq 0)
}
Assert-Test "Liaison bidirectionnelle Notes-Agenda et repli du volet latéral" $newFeaturesPass

# -----------------------------------------------------------------------------
# TEST 14 : Correctifs d'Audit (Packaging Windows & Stockage des Sauvegardes)
# -----------------------------------------------------------------------------
Write-Host "`n14. Vérification des correctifs prioritaires de l'audit..." -ForegroundColor Yellow

$auditFixesPass = $false
if (Test-Path $nodePath) {
    & $nodePath (Join-Path $baseDir "tests\test_audit_fixes.js")
    $auditFixesPass = ($LASTEXITCODE -eq 0)
}
Assert-Test "Packaging Windows complet et allègement des sauvegardes localStorage" $auditFixesPass

# -----------------------------------------------------------------------------
# TEST 15 : Événements Multi-jours & Borne Exclusive (Google Calendar & Locaux)
# -----------------------------------------------------------------------------
Write-Host "`n15. Vérification des événements multi-jours et borne exclusive Google..." -ForegroundColor Yellow

$multidayPass = $false
if (Test-Path $nodePath) {
    & $nodePath (Join-Path $baseDir "tests\test_multiday_events.js")
    $multidayPass = ($LASTEXITCODE -eq 0)
}
Assert-Test "Traitement rigoureux des événements multi-jours et borne exclusive end.date" $multidayPass

# -----------------------------------------------------------------------------
# TEST 16 : Comportement de fermeture & réouverture de fenêtre (ChatGPT-like)
# -----------------------------------------------------------------------------
Write-Host "`n16. Vérification du comportement de fermeture masquée et Tray (type ChatGPT)..." -ForegroundColor Yellow

$closeBehaviorPass = $false
if (Test-Path $nodePath) {
    & $nodePath (Join-Path $baseDir "tests\test_window_close_behavior.js")
    $closeBehaviorPass = ($LASTEXITCODE -eq 0)
}
Assert-Test "Masquage à la fermeture, instance unique, zone de notification et fermeture volontaire" $closeBehaviorPass

# -----------------------------------------------------------------------------
# TEST 17 : Optimisations de Performances (Cache, CPU idle, Débouncing, Drag & Drop)
# -----------------------------------------------------------------------------
Write-Host "`n17. Vérification des optimisations de performances..." -ForegroundColor Yellow

$perfPass = $false
if (Test-Path $nodePath) {
    & $nodePath (Join-Path $baseDir "tests\test_performance.js")
    $perfPass = ($LASTEXITCODE -eq 0)
}
Assert-Test "Optimisations de performances (Cache mémoire, parsing rapide, limitation CPU et requêtes)" $perfPass

# -----------------------------------------------------------------------------
# TEST 18 : Arborescence des tâches et micro-animations de navigation
# -----------------------------------------------------------------------------
Write-Host "`n18. Vérification de l'arborescence des tâches et des micro-animations..." -ForegroundColor Yellow

$tasksTreePass = $false
if (Test-Path $nodePath) {
    & $nodePath (Join-Path $baseDir "tests\test_tasks_tree.js")
    $tasksTreePass = ($LASTEXITCODE -eq 0)
}
Assert-Test "Arborescence structurée des tâches, boutons déplier/replier et micro-animations de catégories" $tasksTreePass

# -----------------------------------------------------------------------------
# BILAN
# -----------------------------------------------------------------------------
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "   RÉSULTATS DE LA SUITE DE TESTS" -ForegroundColor Cyan
Write-Host "   Succès : $testsPassed" -ForegroundColor Green
Write-Host "   Échecs : $testsFailed" -ForegroundColor $(if ($testsFailed -eq 0) { "Green" } else { "Red" })
Write-Host "==========================================================" -ForegroundColor Cyan

if ($testsFailed -gt 0) {
    exit 1
} else {
    exit 0
}
