# R2 Bucket Deletion Script - Robust Version
# Deletes all objects from conversation-data bucket and then deletes the bucket

param(
    [int]$BatchSize = 50,
    [int]$DelayBetweenBatches = 2
)

# Add required assembly for URL encoding
Add-Type -AssemblyName System.Web

$headers = @{
    'X-Auth-Email' = 'writenotenow@gmail.com'
    'X-Auth-Key' = '75d9c0a2d7894f19a088f85375557b65c0dc0'
    'Content-Type' = 'application/json'
}

$bucketName = 'conversation-data'
$accountId = '7e0971c73c7e914503df5aee96a2076f'
$baseUri = "https://api.cloudflare.com/client/v4/accounts/$accountId/r2/buckets/$bucketName"

Write-Host "=== R2 Bucket Deletion Script ===" -ForegroundColor Cyan
Write-Host "Bucket: $bucketName" -ForegroundColor Yellow
Write-Host "Batch Size: $BatchSize objects per batch" -ForegroundColor Yellow
Write-Host "Delay: $DelayBetweenBatches seconds between batches" -ForegroundColor Yellow
Write-Host ""

$totalDeleted = 0
$batchCount = 0
$errors = @()

try {
    do {
        $batchCount++
        Write-Host "--- Batch $batchCount ---" -ForegroundColor Green
        
        # Get objects for this batch
        Write-Host "Fetching next $BatchSize objects..."
        try {
            $response = Invoke-RestMethod -Uri "$baseUri/objects?per_page=$BatchSize" -Headers $headers -Method GET -TimeoutSec 30
        } catch {
            Write-Host "Error fetching objects: $_" -ForegroundColor Red
            $errors += "Batch $batchCount - Fetch error: $_"
            break
        }
        
        $objectsInBatch = $response.result.Count
        if ($objectsInBatch -eq 0) {
            Write-Host "No more objects found. Bucket should be empty." -ForegroundColor Green
            break
        }
        
        Write-Host "Found $objectsInBatch objects to delete in this batch"
        
        # Delete objects in this batch
        $deletedInBatch = 0
        foreach ($obj in $response.result) {
            try {
                $encodedKey = [System.Web.HttpUtility]::UrlEncode($obj.key)
                $deleteUri = "$baseUri/objects/$encodedKey"
                
                Invoke-RestMethod -Uri $deleteUri -Headers $headers -Method DELETE -TimeoutSec 15 | Out-Null
                $deletedInBatch++
                $totalDeleted++
                
                # Show progress every 10 deletions
                if ($deletedInBatch % 10 -eq 0) {
                    Write-Host "  Deleted $deletedInBatch/$objectsInBatch in this batch..." -ForegroundColor Gray
                }
                
            } catch {
                Write-Host "  Failed to delete '$($obj.key)': $_" -ForegroundColor Red
                $errors += "Failed to delete '$($obj.key)': $_"
            }
        }
        
        Write-Host "Batch $batchCount complete: $deletedInBatch/$objectsInBatch deleted (Total: $totalDeleted)" -ForegroundColor Green
        
        # Delay between batches to avoid rate limiting
        if ($objectsInBatch -eq $BatchSize) {  # Only delay if we might have more batches
            Write-Host "Waiting $DelayBetweenBatches seconds before next batch..."
            Start-Sleep -Seconds $DelayBetweenBatches
        }
        
    } while ($objectsInBatch -gt 0)
    
    Write-Host ""
    Write-Host "=== Object Deletion Complete ===" -ForegroundColor Cyan
    Write-Host "Total objects deleted: $totalDeleted" -ForegroundColor Green
    Write-Host "Total batches processed: $batchCount" -ForegroundColor Green
    
    if ($errors.Count -gt 0) {
        Write-Host "Errors encountered: $($errors.Count)" -ForegroundColor Yellow
        Write-Host "First few errors:" -ForegroundColor Yellow
        $errors[0..4] | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    }
    
    # Now try to delete the bucket
    Write-Host ""
    Write-Host "=== Deleting Empty Bucket ===" -ForegroundColor Cyan
    try {
        $bucketDeleteResponse = Invoke-RestMethod -Uri $baseUri -Headers $headers -Method DELETE -TimeoutSec 30
        
        if ($bucketDeleteResponse.success) {
            Write-Host "SUCCESS: Bucket '$bucketName' has been deleted!" -ForegroundColor Green
        } else {
            Write-Host "Failed to delete bucket. Errors:" -ForegroundColor Red
            $bucketDeleteResponse.errors | ForEach-Object { Write-Host "  $($_.message)" -ForegroundColor Red }
        }
    } catch {
        Write-Host "Error deleting bucket: $_" -ForegroundColor Red
        Write-Host "The bucket might still contain objects or there might be a temporary issue." -ForegroundColor Yellow
        Write-Host "You can try running the script again or check the Cloudflare dashboard." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Unexpected error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Script Complete ===" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  Objects deleted: $totalDeleted" -ForegroundColor White
Write-Host "  Batches processed: $batchCount" -ForegroundColor White
Write-Host "  Errors: $($errors.Count)" -ForegroundColor White