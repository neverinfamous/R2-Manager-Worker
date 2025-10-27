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
  folders: string[]
  pagination: PaginationInfo
}

interface ListFilesOptions {
  skipCache?: boolean
  prefix?: string
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
        'image/bmp',
        'image/vnd.adobe.photoshop'
      ]
    },
    video: {
      maxSize: 500 * 1024 * 1024, // 500MB
      description: 'Videos',
      accept: [
        'video/mp4',
        'video/quicktime',
        'video/webm',
        'video/x-msvideo',
        'video/x-ms-wmv',
        'video/x-matroska',
        'video/mpeg',
        'video/x-flv',
        'video/ogg',
        'video/3gpp',
        'video/3gpp2'
      ]
    },
    audio: {
      maxSize: 100 * 1024 * 1024, // 100MB
      description: 'Audio',
      accept: [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/wave',
        'audio/ogg',
        'audio/flac',
        'audio/x-flac',
        'audio/aac',
        'audio/x-aac',
        'audio/m4a',
        'audio/x-m4a',
        'audio/webm',
        'audio/opus'
      ]
    },
    font: {
      maxSize: 10 * 1024 * 1024, // 10MB
      description: 'Fonts',
      accept: [
        'font/ttf',
        'font/otf',
        'font/woff',
        'font/woff2',
        'application/font-woff',
        'application/font-woff2',
        'application/x-font-ttf',
        'application/x-font-otf',
        'application/vnd.ms-fontobject'
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
        'text/rtf',
        'application/x-sqlite3',
        'application/vnd.sqlite3',
        'application/x-db'
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
        'text/x-sql',
        'text/x-toml',
        'application/toml'
      ]
    },
    config: {
      maxSize: 10 * 1024 * 1024, // 10MB
      description: 'Config & Metadata files',
      accept: [
        'application/toml',
        'text/x-toml',
        'application/json',
        'application/x-jsonc',
        'text/plain'
      ]
    },
    devenv: {
      maxSize: 1 * 1024 * 1024, // 1MB
      description: 'Dev Environment files',
      accept: [
        'text/plain',
        'text/x-shellscript'
      ]
    },
    dataformat: {
      maxSize: 50 * 1024 * 1024, // 50MB
      description: 'Data Format files',
      accept: [
        'application/octet-stream',
        'text/plain'
      ]
    },
    docs: {
      maxSize: 10 * 1024 * 1024, // 10MB
      description: 'Documentation & Text files',
      accept: [
        'text/plain'
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
      'webp': 'image', 'avif': 'image', 'heic': 'image', 'svg': 'image', 'bmp': 'image', 'psd': 'image',
      // Videos
      'mp4': 'video', 'mov': 'video', 'webm': 'video', 'avi': 'video', 'wmv': 'video', 'mkv': 'video',
      'mpeg': 'video', 'mpg': 'video', 'mpeg4': 'video', 'flv': 'video', 'ogg': 'video', 'ogv': 'video', 
      '3gp': 'video', '3g2': 'video', 'm4v': 'video',
      // Audio
      'mp3': 'audio', 'wav': 'audio', 'flac': 'audio', 'aac': 'audio', 'm4a': 'audio', 'oga': 'audio', 'opus': 'audio',
      // Fonts
      'ttf': 'font', 'otf': 'font', 'woff': 'font', 'woff2': 'font', 'eot': 'font',
      // Documents
      'pdf': 'document', 'doc': 'document', 'docx': 'document',
      'xls': 'document', 'xlsx': 'document', 'ppt': 'document', 'pptx': 'document',
      'txt': 'document', 'md': 'document', 'markdown': 'document', 'csv': 'document', 'rtf': 'document',
      'db': 'document', 'sqlite': 'document', 'sqlite3': 'document',
      // Archives
      'zip': 'archive', 'rar': 'archive', '7z': 'archive', 'tar': 'code', 'gz': 'archive',
      // Code files
      'js': 'code', 'jsx': 'code', 'ts': 'code', 'tsx': 'code',
      'py': 'code', 'java': 'code', 'c': 'code', 'cpp': 'code', 'cc': 'code',
      'cs': 'code', 'go': 'code', 'rs': 'code', 'php': 'code',
      'rb': 'code', 'swift': 'code', 'kt': 'code', 'html': 'code',
      'css': 'code', 'json': 'code', 'xml': 'code', 'yaml': 'code', 'yml': 'code',
      'sql': 'code', 'ipynb': 'code', 'parquet': 'document',
      'toml': 'config', 'jsonc': 'config', 'env': 'config', 'lock': 'config',
      'conf': 'config', 'ini': 'config',
      'gitignore': 'devenv', 'gitattributes': 'devenv', 'editorconfig': 'devenv', 
      'dockerfile': 'devenv', 'nvmrc': 'devenv', 'browserslistrc': 'devenv',
      'feather': 'dataformat', 'avro': 'dataformat', 'ndjson': 'dataformat',
      'nfo': 'docs'
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
    options: UploadOptions = {},
    fileName?: string
  ): Promise<void> {
    const {
      maxRetries = this.DEFAULT_MAX_RETRIES,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      onRetry
    } = options
    
    const uploadFileName = fileName || file.name
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const formData = new FormData()
        formData.append('file', chunk, uploadFileName)

        const response = await fetch(`${WORKER_API}/api/files/${bucketName}/upload`, 
          this.getFetchOptions({
            method: 'POST',
            headers: {
              ...this.getHeaders(),
              'X-File-Name': encodeURIComponent(uploadFileName),
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
    options: UploadOptions = {},
    path?: string
  ): Promise<void> {
    const validation = this.validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const { onProgress, maxRetries, retryDelay, onRetry } = options

    // Prepend path to filename if provided (but not if path is empty string)
    const fileName = path && path.length > 0 ? `${path}${file.name}` : file.name
    console.log('[API] uploadFile - path:', path, 'file.name:', file.name, 'final fileName:', fileName)

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
          { maxRetries, retryDelay, onRetry },
          fileName
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
          { maxRetries, retryDelay, onRetry },
          fileName
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

    if (options.prefix) {
      url.searchParams.set('prefix', options.prefix)
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

  async moveFile(sourceBucket: string, sourceKey: string, destBucket: string, destPath?: string): Promise<void> {
    const response = await fetch(
      `${WORKER_API}/api/files/${sourceBucket}/${encodeURIComponent(sourceKey)}/move`,
      this.getFetchOptions({
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          destinationBucket: destBucket,
          destinationPath: destPath 
        })
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
    destPath?: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    for (let i = 0; i < fileKeys.length; i++) {
      await this.moveFile(sourceBucket, fileKeys[i], destBucket, destPath)
      onProgress?.(i + 1, fileKeys.length)
    }
  }

  async copyFile(sourceBucket: string, sourceKey: string, destBucket: string, destPath?: string): Promise<void> {
    const response = await fetch(
      `${WORKER_API}/api/files/${sourceBucket}/${encodeURIComponent(sourceKey)}/copy`,
      this.getFetchOptions({
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          destinationBucket: destBucket,
          destinationPath: destPath 
        })
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
    destPath?: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    for (let i = 0; i < fileKeys.length; i++) {
      await this.copyFile(sourceBucket, fileKeys[i], destBucket, destPath)
      onProgress?.(i + 1, fileKeys.length)
    }
  }

  async renameFile(
    bucketName: string,
    sourceKey: string,
    newKey: string
  ): Promise<void> {
    // Extract directory path from source
    const sourceParts = sourceKey.split('/')
    const sourceDir = sourceParts.slice(0, -1).join('/')
    
    // If newKey doesn't include path, prepend source directory
    let targetKey = newKey
    if (!newKey.includes('/') && sourceDir) {
      targetKey = `${sourceDir}/${newKey}`
    }

    const response = await fetch(
      `${WORKER_API}/api/files/${bucketName}/${encodeURIComponent(sourceKey)}/rename`,
      this.getFetchOptions({
        method: 'PATCH',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newKey: targetKey })
      })
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        error: `Failed to rename file: ${response.status}` 
      }))
      throw new Error(error.error || 'Failed to rename file')
    }
  }

  validateFileName(name: string): ValidationResult {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'File name cannot be empty' }
    }
    
    const trimmedName = name.trim()
    
    // Check for invalid characters
    // eslint-disable-next-line no-control-regex
    const invalidChars = /[<>:"|?*\x00-\x1F]/g
    if (invalidChars.test(trimmedName)) {
      return { valid: false, error: 'File name contains invalid characters' }
    }
    
    // Check for reserved names (Windows compatibility)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
    if (reservedNames.test(trimmedName)) {
      return { valid: false, error: 'File name is reserved' }
    }
    
    return { valid: true }
  }

  async getSignedUrl(bucketName: string, fileName: string): Promise<string> {
    const response = await fetch(
      `${WORKER_API}/api/files/${bucketName}/signed-url/${encodeURIComponent(fileName)}`,
      this.getFetchOptions({
        method: 'GET',
        headers: this.getHeaders()
      })
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `Failed to generate signed URL: ${response.status}` }))
      throw new Error(error.error || 'Failed to generate signed URL')
    }

    const data = await response.json()
    return data.url
  }

  // Folder Management Methods

  validateFolderName(name: string): ValidationResult {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Folder name cannot be empty' }
    }
    const trimmedName = name.trim()
    const validPattern = /^[a-zA-Z0-9-_/]+$/
    if (!validPattern.test(trimmedName)) {
      return { valid: false, error: 'Folder name can only contain letters, numbers, hyphens, underscores, and forward slashes' }
    }
    if (trimmedName.includes('//')) {
      return { valid: false, error: 'Folder name cannot contain consecutive slashes' }
    }
    if (trimmedName.startsWith('/') || trimmedName.endsWith('/')) {
      return { valid: false, error: 'Folder name cannot start or end with a slash' }
    }
    return { valid: true }
  }

  async createFolder(bucketName: string, folderName: string): Promise<void> {
    const validation = this.validateFolderName(folderName)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const response = await fetch(
      `${WORKER_API}/api/folders/${bucketName}/create`,
      this.getFetchOptions({
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ folderName: folderName.trim() })
      })
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `Failed to create folder: ${response.status}` }))
      throw new Error(error.error || 'Failed to create folder')
    }
  }

  async renameFolder(
    bucketName: string,
    oldPath: string,
    newPath: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    const response = await fetch(
      `${WORKER_API}/api/folders/${bucketName}/rename`,
      this.getFetchOptions({
        method: 'PATCH',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ oldPath, newPath })
      })
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `Failed to rename folder: ${response.status}` }))
      throw new Error(error.error || 'Failed to rename folder')
    }

    const data = await response.json()
    if (onProgress && data.copied) {
      onProgress(data.copied, data.copied + (data.failed || 0))
    }
  }

  async copyFolder(
    sourceBucket: string,
    folderPath: string,
    destBucket: string,
    destPath?: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    const response = await fetch(
      `${WORKER_API}/api/folders/${sourceBucket}/${encodeURIComponent(folderPath)}/copy`,
      this.getFetchOptions({
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ destinationBucket: destBucket, destinationPath: destPath })
      })
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `Failed to copy folder: ${response.status}` }))
      throw new Error(error.error || 'Failed to copy folder')
    }

    const data = await response.json()
    if (onProgress && data.copied) {
      onProgress(data.copied, data.copied + (data.failed || 0))
    }
  }

  async moveFolder(
    sourceBucket: string,
    folderPath: string,
    destBucket: string,
    destPath?: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    const response = await fetch(
      `${WORKER_API}/api/folders/${sourceBucket}/${encodeURIComponent(folderPath)}/move`,
      this.getFetchOptions({
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ destinationBucket: destBucket, destinationPath: destPath })
      })
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `Failed to move folder: ${response.status}` }))
      throw new Error(error.error || 'Failed to move folder')
    }

    const data = await response.json()
    if (onProgress && data.moved) {
      onProgress(data.moved, data.moved + (data.failed || 0))
    }
  }

  async deleteFolder(bucketName: string, folderPath: string, force: boolean = false): Promise<{ success: boolean, fileCount?: number, message?: string }> {
    const url = new URL(`${WORKER_API}/api/folders/${bucketName}/${encodeURIComponent(folderPath)}`)
    if (force) {
      url.searchParams.set('force', 'true')
    }

    const response = await fetch(
      url.toString(),
      this.getFetchOptions({
        method: 'DELETE',
        headers: this.getHeaders()
      })
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `Failed to delete folder: ${response.status}` }))
      throw new Error(error.error || 'Failed to delete folder')
    }

    return response.json()
  }

  async searchAcrossBuckets(params: {
    query?: string;
    extensions?: string[];
    minSize?: number | null;
    maxSize?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
    limit?: number;
  }) {
    const url = new URL(`${WORKER_API}/api/search`)
    
    if (params.query) {
      url.searchParams.set('q', params.query)
    }
    if (params.extensions && params.extensions.length > 0) {
      url.searchParams.set('extensions', params.extensions.join(','))
    }
    if (params.minSize !== null && params.minSize !== undefined) {
      url.searchParams.set('minSize', params.minSize.toString())
    }
    if (params.maxSize !== null && params.maxSize !== undefined) {
      url.searchParams.set('maxSize', params.maxSize.toString())
    }
    if (params.startDate) {
      url.searchParams.set('startDate', params.startDate.toISOString())
    }
    if (params.endDate) {
      url.searchParams.set('endDate', params.endDate.toISOString())
    }
    if (params.limit) {
      url.searchParams.set('limit', params.limit.toString())
    }

    const response = await fetch(
      url.toString(),
      this.getFetchOptions({
        headers: this.getHeaders()
      })
    )

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }

    return response.json()
  }

}

export const api = new APIService();

