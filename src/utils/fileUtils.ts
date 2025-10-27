export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || ''
}

export const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic', '.svg', '.bmp', '.psd']
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext))
}

export const isVideoFile = (filename: string): boolean => {
  const ext = getFileExtension(filename)
  // Only return true for formats that reliably play in HTML5 video element
  // Other formats (AVI, WMV, MKV, FLV, MPEG, 3GP, OGG, OGV) often use codecs not supported by browsers
  // These will still show the proper video icon but won't attempt HTML5 preview
  return ['mp4', 'mov', 'webm'].includes(ext)
}

