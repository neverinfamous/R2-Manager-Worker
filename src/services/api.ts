const WORKER_API = 'https://r2.adamic.tech'

type ProgressCallback = (progress: number) => void
type RetryCallback = (attempt: number, chunk: number, error: Error) => void

interface AuthResponse {
  token?: string
  error?: string
}

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
        'image/svg+xml',
        'image/bmp'
      ]
    },
    video: {
      maxSize: 100 * 1024 * 1024, // 100MB
      description: 'Videos',
      accept: [
        'video/mp4'
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
        'text/csv'
      ]
    },
    archive: {
      maxSize: 1024 * 1024 * 1024, // 1GB
      description: 'Archives',
      accept: [
        'application/zip',
        'application/x-zip-compressed',
        'application/x-7z-compressed',
        'application/x-rar-compressed'
      ]
    },
    code: {
      maxSize: 10 * 1024 * 1024, // 10MB
      description: 'Code files',
      accept: [
        'text/javascript',
        'application/javascript',
        'text/typescript',
        'text/x-python',
        'text/x-java',
        'text/x-c',
        'text/x-cpp',
        'text/x-ruby',
        'text/x-php',
        'text/x-go',
        'text/html',
        'text/css',
        'application/json',
        'text/xml',
        'application/x-yaml',
        'text/x-markdown'
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
    const config = this.getFileTypeConfig(file.type)
    
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

  setToken(token: string) {
    this.token = token
  }

  clearToken() {
    this.token = null
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

  async register(email: string, password: string, code: string): Promise<AuthResponse> {
    const response = await fetch(`${WORKER_API}/api/auth/register`, 
      this.getFetchOptions({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, code })
      })
    )
    
    return response.json()
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${WORKER_API}/api/auth/login`, 
      this.getFetchOptions({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })
    )
    
    const data = await response.json()
    
    // Handle new response format: {success: true, token?: string}
    if (data.success === true && response.ok) {
      // Store token if provided (fallback for CORS-blocked cookies)
      if (data.token) {
        this.setToken(data.token)
        return { token: data.token }
      }
      // Return empty object to trigger cookie-based auth if no token
      return {}
    }
    
    // Handle old response format: {token, error}
    if (data.token) {
      this.setToken(data.token)
    }
    
    return data
  }

  async logout() {
    try {
      await fetch(`${WORKER_API}/api/auth/logout`, 
        this.getFetchOptions({
          method: 'POST',
          headers: this.getHeaders()
        })
      )
    } finally {
      this.clearToken()
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

  getRecommendedApps(fileName: string): { name: string; url: string | null }[] {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    
    const appMap: Record<string, { name: string; url: string | null }[]> = {
      // Code files
      'js': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' },
        { name: 'WebStorm', url: 'https://www.jetbrains.com/webstorm' },
        { name: 'Sublime Text', url: 'https://www.sublimetext.com' }
      ],
      'ts': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' },
        { name: 'WebStorm', url: 'https://www.jetbrains.com/webstorm' },
        { name: 'Sublime Text', url: 'https://www.sublimetext.com' }
      ],
      'tsx': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' },
        { name: 'WebStorm', url: 'https://www.jetbrains.com/webstorm' }
      ],
      'jsx': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' },
        { name: 'WebStorm', url: 'https://www.jetbrains.com/webstorm' }
      ],
      'py': [
        { name: 'PyCharm', url: 'https://www.jetbrains.com/pycharm' },
        { name: 'VS Code', url: 'https://code.visualstudio.com' },
        { name: 'Thonny', url: 'https://thonny.org' }
      ],
      'java': [
        { name: 'IntelliJ IDEA', url: 'https://www.jetbrains.com/idea' },
        { name: 'Eclipse', url: 'https://www.eclipse.org' }
      ],
      'cpp': [
        { name: 'Visual Studio', url: 'https://visualstudio.microsoft.com' },
        { name: 'CLion', url: 'https://www.jetbrains.com/clion' }
      ],
      'go': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' },
        { name: 'GoLand', url: 'https://www.jetbrains.com/go' }
      ],
      'rb': [
        { name: 'RubyMine', url: 'https://www.jetbrains.com/ruby' },
        { name: 'VS Code', url: 'https://code.visualstudio.com' }
      ],
      'php': [
        { name: 'PhpStorm', url: 'https://www.jetbrains.com/phpstorm' },
        { name: 'VS Code', url: 'https://code.visualstudio.com' }
      ],
      'html': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' },
        { name: 'WebStorm', url: 'https://www.jetbrains.com/webstorm' }
      ],
      'css': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' },
        { name: 'WebStorm', url: 'https://www.jetbrains.com/webstorm' }
      ],
      'json': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' },
        { name: 'Sublime Text', url: 'https://www.sublimetext.com' }
      ],
      'xml': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' },
        { name: 'Sublime Text', url: 'https://www.sublimetext.com' }
      ],
      'yml': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' }
      ],
      'yaml': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' }
      ],
      'md': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' },
        { name: 'Typora', url: 'https://typora.io' },
        { name: 'Obsidian', url: 'https://obsidian.md' }
      ],
      'txt': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' },
        { name: 'Notepad++', url: 'https://notepad-plus-plus.org' }
      ],
      'sql': [
        { name: 'VS Code', url: 'https://code.visualstudio.com' },
        { name: 'DataGrip', url: 'https://www.jetbrains.com/datagrip' }
      ],
      'csv': [
        { name: 'Microsoft Excel', url: 'https://www.microsoft.com/office' },
        { name: 'LibreOffice Calc', url: 'https://www.libreoffice.org' }
      ],

      // Image files
      'png': [
        { name: 'Photoshop', url: 'https://www.adobe.com/products/photoshop' },
        { name: 'GIMP', url: 'https://www.gimp.org' },
        { name: 'Paint.NET', url: 'https://www.getpaint.net' }
      ],
      'jpg': [
        { name: 'Photoshop', url: 'https://www.adobe.com/products/photoshop' },
        { name: 'GIMP', url: 'https://www.gimp.org' },
        { name: 'Lightroom', url: 'https://www.adobe.com/products/lightroom' }
      ],
      'jpeg': [
        { name: 'Photoshop', url: 'https://www.adobe.com/products/photoshop' },
        { name: 'GIMP', url: 'https://www.gimp.org' }
      ],
      'gif': [
        { name: 'GIMP', url: 'https://www.gimp.org' },
        { name: 'Photoshop', url: 'https://www.adobe.com/products/photoshop' }
      ],
      'webp': [
        { name: 'Photoshop', url: 'https://www.adobe.com/products/photoshop' },
        { name: 'GIMP', url: 'https://www.gimp.org' }
      ],
      'svg': [
        { name: 'Illustrator', url: 'https://www.adobe.com/products/illustrator' },
        { name: 'Inkscape', url: 'https://inkscape.org' }
      ],

      // Video files
      'mp4': [
        { name: 'VLC Media Player', url: 'https://www.videolan.org' },
        { name: 'Adobe Premiere Pro', url: 'https://www.adobe.com/products/premiere' },
        { name: 'DaVinci Resolve', url: 'https://www.blackmagicdesign.com/products/davinciresolve' }
      ],
      'mov': [
        { name: 'QuickTime', url: null },
        { name: 'VLC Media Player', url: 'https://www.videolan.org' }
      ],
      'avi': [
        { name: 'VLC Media Player', url: 'https://www.videolan.org' },
        { name: 'Windows Media Player', url: null }
      ],
      'mkv': [
        { name: 'VLC Media Player', url: 'https://www.videolan.org' },
        { name: 'MPC-HC', url: 'https://mpc-hc.org' }
      ],

      // Document files
      'pdf': [
        { name: 'Adobe Acrobat Reader', url: 'https://get.adobe.com/reader' },
        { name: 'Preview', url: null },
        { name: 'Firefox', url: 'https://www.mozilla.org/firefox' }
      ],
      'docx': [
        { name: 'Microsoft Word', url: 'https://www.microsoft.com/office' },
        { name: 'Google Docs', url: 'https://docs.google.com' },
        { name: 'LibreOffice Writer', url: 'https://www.libreoffice.org' }
      ],
      'doc': [
        { name: 'Microsoft Word', url: 'https://www.microsoft.com/office' },
        { name: 'Google Docs', url: 'https://docs.google.com' }
      ],
      'xlsx': [
        { name: 'Microsoft Excel', url: 'https://www.microsoft.com/office' },
        { name: 'Google Sheets', url: 'https://sheets.google.com' }
      ],
      'xls': [
        { name: 'Microsoft Excel', url: 'https://www.microsoft.com/office' }
      ],
      'pptx': [
        { name: 'Microsoft PowerPoint', url: 'https://www.microsoft.com/office' },
        { name: 'Google Slides', url: 'https://slides.google.com' }
      ],
      'ppt': [
        { name: 'Microsoft PowerPoint', url: 'https://www.microsoft.com/office' }
      ],

      // Archive files
      'zip': [
        { name: '7-Zip', url: 'https://www.7-zip.org' },
        { name: 'WinRAR', url: 'https://www.rarlab.com' },
        { name: 'The Unarchiver', url: 'https://theunarchiver.com' }
      ],
      'rar': [
        { name: 'WinRAR', url: 'https://www.rarlab.com' },
        { name: '7-Zip', url: 'https://www.7-zip.org' }
      ],
      '7z': [
        { name: '7-Zip', url: 'https://www.7-zip.org' },
        { name: 'Bandizip', url: 'https://www.bandisoft.com/bandizip' }
      ],
      'tar': [
        { name: '7-Zip', url: 'https://www.7-zip.org' },
        { name: 'WinRAR', url: 'https://www.rarlab.com' }
      ]
    }
    
    return appMap[ext] || []
  }

  async openFileNatively(bucketName: string, fileName: string, fileObject?: FileObject): Promise<void> {
    try {
      const fileUrl = this.getFileUrl(bucketName, fileName, fileObject)
      
      // Create a temporary link to trigger download with auto-open
      const link = document.createElement('a')
      link.href = fileUrl
      link.download = fileName
      link.target = '_blank'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Failed to open file natively:', error)
      throw new Error('Failed to open file')
    }
  }
}

export const api = new APIService();