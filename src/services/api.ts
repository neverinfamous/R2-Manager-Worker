const WORKER_API = import.meta.env.VITE_WORKER_API || window.location.origin

type ProgressCallback = (progress: number) => void
type RetryCallback = (attempt: number, chunk: number, error: Error) => void

interface FileObject {
  key: string
  size: number
  uploaded: string
  url: string
}

interface PaginationInfo {
  cursor?: string
  hasMore: boolean
}

interface FileListResponse {
  objects: FileObject[]
  pagination: PaginationInfo
}

interface ListFilesOptions {
  skipCache?: boolean
}

interface CloudflareBucket {
  name: string
  creation_date: string
  size?: number
}

interface DownloadOptions {
  asZip?: boolean
  onProgress?: ProgressCallback
  maxTotalSize?: number
}

interface UploadOptions {
  onProgress?: ProgressCallback
  onRetry?: RetryCallback
  maxRetries?: number
  retryDelay?: number
}

interface FileTypeConfig {
  maxSize: number
  description: string
  accept: string[]
}

interface ValidationResult {
  valid: boolean
  error?: string
}

class APIService {
  private token: string | null = null
  private readonly DEFAULT_MAX_RETRIES = 3
  private readonly DEFAULT_RETRY_DELAY = 1000
  private readonly CHUNK_SIZE = 10 * 1024 * 1024 // 10MB chunks

  // File type configurations
  private readonly FILE_TYPES: Record<string, FileTypeConfig> = {
    image: {
      maxSize: 15 * 1024 * 1024, // 15MB
      description: 'Images',
      accept: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/avif',
        'image/heic',
        'image/svg+xml',
        'image/bmp'
      ]
    },
    video: {
      maxSize: 500 * 1024 * 1024, // 500MB
      description: 'Videos',
      accept: [
        'video/mp4',
        'video/quicktime',
        'video/webm'
      ]
    },
    document: {
      maxSize: 50 * 1024 * 1024, // 50MB
      description: 'Documents',
      accept: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/rtf',
        'text/rtf'
      ]
    },
    archive: {
      maxSize: 500 * 1024 * 1024, // 500MB
      description: 'Archives',
      accept: [
        'application/zip',
        'application/x-zip-compressed',
        'application/x-7z-compressed',
        'application/x-rar-compressed',
        'application/x-tar',
        'application/x-gtar',
        'application/gzip',
        'application/x-gzip'
      ]
    },
    code: {
      maxSize: 10 * 1024 * 1024, // 10MB
      description: 'Code files',
      accept: [
        'text/javascript',
        'application/javascript',
        'application/x-javascript',
        'text/typescript',
        'application/typescript',
        'application/x-typescript',
        'text/x-python',
        'text/x-python-script',
        'application/x-python',
        'text/x-java-source',
        'text/x-java',
        'text/x-c',
        'text/x-c++',
        'text/x-cpp',
        'text/x-csrc',
        'text/x-c++src',
        'text/x-csharp',
        'text/x-ruby',
        'application/x-ruby',
        'text/x-php',
        'application/x-php',
        'text/x-go',
        'application/x-go',
        'text/x-rust',
        'application/x-rust',
        'text/x-swift',
        'text/x-kotlin',
        'text/html',
        'application/xhtml+xml',
        'text/css',
        'application/json',
        'application/ld+json',
        'text/xml',
        'application/xml',
        'application/x-yaml',
        'text/yaml',
        'text/x-yaml',
        'text/x-markdown',
        'text/markdown',
        'application/x-tar',
        'application/x-gtar',
        'text/plain',
        'application/sql',
        'text/x-sql'
      ]
    }
  }

  getAllowedMimeTypes(): string[] {
    return Object.values(this.FILE_TYPES).flatMap(type => type.accept)
  }

  getFileTypeConfig(mimeType: string): FileTypeConfig | null {
    for (const [, config] of Object.entries(this.FILE_TYPES)) {
      if (config.accept.includes(mimeType)) {
        return config
      }
    }
    return null
  }

  validateFile(file: File): ValidationResult {
    let config = this.getFileTypeConfig(file.type)
    
    // If MIME type is not recognized or is text/plain, try to determine by extension
    if (!config || file.type === 'text/plain' || file.type === '') {
      const ext = file.name.split('.').pop()?.toLowerCase()
      const configByExt = this.getConfigByExtension(ext)
      if (configByExt) {
        config = configByExt
      }
    }
    
    if (!config) {
      const allowedTypes = Object.values(this.FILE_TYPES)
        .map(type => type.description)
        .join(', ')
      return {
        valid: false,
        error: `File type not allowed. Accepted file types are: ${allowedTypes}`
      }
    }
    
    if (file.size > config.maxSize) {
      return {
        valid: false,
        error: `File size exceeds the limit of ${this.formatSize(config.maxSize)} for ${config.description.toLowerCase()}`
      }
    }
    
    return { valid: true }
  }

  private getConfigByExtension(ext: string | undefined): FileTypeConfig | null {
    if (!ext) return null
    
    const extensionMap: Record<string, string> = {
      // Images
      'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 
      'webp': 'image', 'avif': 'image', 'heic': 'image', 'svg': 'image', 'bmp': 'image',
      // Videos
      'mp4': 'video', 'mov': 'video', 'webm': 'video',
      // Documents
      'pdf': 'document', 'doc': 'document', 'docx': 'document',
      'xls': 'document', 'xlsx': 'document', 'ppt': 'document', 'pptx': 'document',
      'txt': 'document', 'md': 'document', 'csv': 'document', 'rtf': 'document',
      // Archives
      'zip': 'archive', 'rar': 'archive', '7z': 'archive', 'tar': 'code', 'gz': 'archive',
      // Code files
      'js': 'code', 'jsx': 'code', 'ts': 'code', 'tsx': 'code',
      'py': 'code', 'java': 'code', 'c': 'code', 'cpp': 'code', 'cc': 'code',
      'cs': 'code', 'go': 'code', 'rs': 'code', 'php': 'code',
      'rb': 'code', 'swift': 'code', 'kt': 'code', 'html': 'code',
      'css': 'code', 'json': 'code', 'xml': 'code', 'yaml': 'code', 'yml': 'code',
      'sql': 'code', 'ipynb': 'code', 'parquet': 'document'
    }
    
    const category = extensionMap[ext]
    return category ? this.FILE_TYPES[category] : null
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  private getHeaders(): HeadersInit {
    // Cookies are now handled automatically via credentials: 'include'
    // Keep token handling for backward compatibility during migration
    const headers: HeadersInit = {}
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  private getFetchOptions(init?: RequestInit): RequestInit {
    // Always include credentials so cookies are sent automatically
    return {
      ...init,
      credentials: 'include'
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async uploadChunkWithRetry(
    bucketName: string,
    file: File,
    chunk: Blob,
    chunkIndex: number,
    totalChunks: number,
    options: UploadOptions = {}
  ): Promise<void> {
    const {
      maxRetries = this.DEFAULT_MAX_RETRIES,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      onRetry
    } = options
    
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const formData = new FormData()
        formData.append('file', chunk, file.name)

        const response = await fetch(`${WORKER_API}/api/files/${bucketName}/upload`, 
          this.getFetchOptions({
            method: 'POST',
            headers: {
              ...this.getHeaders(),
              'X-File-Name': encodeURIComponent(file.name),
              'X-Total-Chunks': totalChunks.toString(),
              'X-Chunk-Index': chunkIndex.toString()
            },
            body: formData
          })
        )

        if (!response.ok) {
          throw new Error(`Upload failed with status: ${response.status}`)
        }

        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error during upload')
        if (attempt < maxRetries - 1) {
          onRetry?.(attempt + 1, chunkIndex, lastError)
          await this.sleep(retryDelay * Math.pow(2, attempt))
          continue
        }
        throw new Error(`Failed to upload chunk ${chunkIndex} after ${maxRetries} attempts: ${lastError.message}`)
      }
    }
  }

  async uploadFile(
    bucketName: string,
    file: File,
    options: UploadOptions = {}
  ): Promise<void> {
    const validation = this.validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const { onProgress, maxRetries, retryDelay, onRetry } = options

    const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE)
    const uploadedChunks = new Set<number>()
    
    try {
      if (file.size <= this.CHUNK_SIZE) {
        await this.uploadChunkWithRetry(
          bucketName,
          file,
          file,
          0,
          1,
          { maxRetries, retryDelay, onRetry }
        )
        onProgress?.(100)
        return
      }

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (uploadedChunks.has(chunkIndex)) continue

        const start = chunkIndex * this.CHUNK_SIZE
        const end = Math.min(start + this.CHUNK_SIZE, file.size)
        const chunk = file.slice(start, end)

        await this.uploadChunkWithRetry(
          bucketName,
          file,
          chunk,
          chunkIndex,
          totalChunks,
          { maxRetries, retryDelay, onRetry }
        )

        uploadedChunks.add(chunkIndex)
        const progress = (uploadedChunks.size / totalChunks) * 100
        onProgress?.(Math.min(progress, 99.9))
      }

      onProgress?.(100)

    } catch (error) {
      const failedChunks = Array.from({ length: totalChunks }, (_, i) => i)
        .filter(i => !uploadedChunks.has(i))

      console.error('Upload failed:', {
        fileName: file.name,
        totalChunks,
        uploadedChunks: Array.from(uploadedChunks),
        failedChunks,
        error
      })

      throw new Error(
        `Upload failed: ${failedChunks.length} chunks remaining. ` +
        `Last error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async listBuckets() {
    const response = await fetch(`${WORKER_API}/api/buckets`, 
      this.getFetchOptions({
        headers: this.getHeaders()
      })
    )
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return data.result.buckets.map((bucket: CloudflareBucket) => ({
      name: bucket.name,
      created: bucket.creation_date,
      size: bucket.size || 0
    }))
  }

  async createBucket(name: string) {
    const response = await fetch(`${WORKER_API}/api/buckets`, 
      this.getFetchOptions({
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      })
    )
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    const data = await response.json()
    return data.result
  }

  async deleteBucket(name: string, options: { force?: boolean } = {}) {
    const url = new URL(`${WORKER_API}/api/buckets/${name}`)
    if (options.force) {
      url.searchParams.set('force', 'true')
    }
    
    const response = await fetch(url.toString(), 
      this.getFetchOptions({
        method: 'DELETE',
        headers: this.getHeaders()
      })
    )
    
    // Parse the response regardless of status code
    let data
    try {
      data = await response.json()
    } catch {
      // If response can't be parsed as JSON, return a generic error
      data = { error: `Failed to delete bucket (HTTP ${response.status})` }
    }
    
    // Return the data along with any context needed
    return data
  }

  validateBucketName(name: string): ValidationResult {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Bucket name cannot be empty' }
    }
    const trimmedName = name.trim()
    if (trimmedName.length < 3) {
      return { valid: false, error: 'Bucket name must be at least 3 characters' }
    }
    if (trimmedName.length > 63) {
      return { valid: false, error: 'Bucket name cannot exceed 63 characters' }
    }
    const validPattern = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/
    if (!validPattern.test(trimmedName)) {
      return { valid: false, error: 'Bucket name can only contain lowercase letters, numbers, and hyphens' }
    }
    return { valid: true }
  }

  async renameBucket(oldName: string, newName: string) {
    const validation = this.validateBucketName(newName)
    if (!validation.valid) {
      throw new Error(validation.error)
    }
    const url = `${WORKER_API}/api/buckets/${encodeURIComponent(oldName)}`
    const response = await fetch(
      url,
      this.getFetchOptions({
        method: 'PATCH',
        headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: newName.trim() })
      })
    )
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      throw new Error(error.error || 'Failed to rename bucket')
    }
    return response.json()
  }

  async listFiles(
    bucketName: string,
    cursor?: string,
    limit: number = 20,
    options: ListFilesOptions = {}
  ): Promise<FileListResponse> {
    const url = new URL(`${WORKER_API}/api/files/${bucketName}`)
    if (cursor) {
      url.searchParams.set('cursor', cursor)
    }
    url.searchParams.set('limit', limit.toString())

    if (options.skipCache) {
      url.searchParams.set('skipCache', 'true')
    }

    const response = await fetch(url, 
      this.getFetchOptions({
        headers: this.getHeaders()
      })
    )
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    return response.json()
  }

  async deleteFile(bucketName: string, fileName: string) {
    const response = await fetch(
      `${WORKER_API}/api/files/${bucketName}/delete/${encodeURIComponent(fileName)}`,
      this.getFetchOptions({
        method: 'DELETE',
        headers: this.getHeaders()
      })
    )
    
    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`)
    }
  }

  async downloadFiles(bucketName: string, files: FileObject[], options: DownloadOptions = {}) {
    const { asZip = false, onProgress } = options
    const totalSize = files.reduce((total, file) => total + file.size, 0)
    const config = this.FILE_TYPES.archive

    if (asZip && totalSize > config.maxSize) {
      throw new Error(`Total size exceeds the limit of ${this.formatSize(config.maxSize)} for zip downloads`)
    }

    if (!asZip || files.length === 1) {
      const file = files[0]
      const url = this.getFileUrl(bucketName, file.key, file)
      const link = document.createElement('a')
      link.href = url
      link.download = file.key
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      onProgress?.(100)
      return
    }

    const response = await fetch(`${WORKER_API}/api/files/${bucketName}/download-zip`, 
      this.getFetchOptions({
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: files.map(f => f.key)
        })
      })
    )

    if (!response.ok) {
      throw new Error('Failed to download files')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${bucketName}-files.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    onProgress?.(100)
  }

  getFileUrl(bucketName: string, fileName: string, fileObject?: FileObject): string {
    if (fileObject?.url) {
      return `${WORKER_API}${fileObject.url}`
    }
    
    return `${WORKER_API}/api/files/${bucketName}/download/${encodeURIComponent(fileName)}`
  }

  async downloadBucket(bucketName: string, options: DownloadOptions = {}): Promise<void> {
    const { onProgress } = options

    try {
      let allFiles: FileObject[] = []
      let cursor: string | undefined = undefined

      do {
        const response = await this.listFiles(bucketName, cursor)
        allFiles = [...allFiles, ...response.objects]
        cursor = response.pagination.cursor
      } while (cursor)

      const totalSize = allFiles.reduce((total, file) => total + file.size, 0)
      const config = this.FILE_TYPES.archive

      if (totalSize > config.maxSize) {
        throw new Error(`Total size exceeds the limit of ${this.formatSize(config.maxSize)} for bucket downloads`)
      }

      const response = await fetch(`${WORKER_API}/api/files/${bucketName}/download-zip`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: allFiles.map(f => f.key)
        })
      })

      if (!response.ok) {
        throw new Error('Failed to download bucket')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${bucketName}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      onProgress?.(100)
    } catch (error) {
      console.error('Bucket download failed:', error)
      throw new Error('Failed to download bucket')
    }
  }

  async moveFile(sourceBucket: string, sourceKey: string, destBucket: string): Promise<void> {
    const response = await fetch(
      `${WORKER_API}/api/files/${sourceBucket}/${encodeURIComponent(sourceKey)}/move`,
      this.getFetchOptions({
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ destinationBucket: destBucket })
      })
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `Failed to move file: ${response.status}` }))
      throw new Error(error.error || 'Failed to move file')
    }
  }

  async moveFiles(
    sourceBucket: string,
    fileKeys: string[],
    destBucket: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    for (let i = 0; i < fileKeys.length; i++) {
      await this.moveFile(sourceBucket, fileKeys[i], destBucket)
      onProgress?.(i + 1, fileKeys.length)
    }
  }

  async copyFile(sourceBucket: string, sourceKey: string, destBucket: string): Promise<void> {
    const response = await fetch(
      `${WORKER_API}/api/files/${sourceBucket}/${encodeURIComponent(sourceKey)}/copy`,
      this.getFetchOptions({
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ destinationBucket: destBucket })
      })
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `Failed to copy file: ${response.status}` }))
      throw new Error(error.error || 'Failed to copy file')
    }
  }

  async copyFiles(
    sourceBucket: string,
    fileKeys: string[],
    destBucket: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    for (let i = 0; i < fileKeys.length; i++) {
      await this.copyFile(sourceBucket, fileKeys[i], destBucket)
      onProgress?.(i + 1, fileKeys.length)
    }
  }


}

export const api = new APIService();