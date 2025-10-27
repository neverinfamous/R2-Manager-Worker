import { useCallback, useState, useEffect, useRef } from 'react'

interface VideoPlayerProps {
  src: string
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

export const VideoPlayer = ({ src, className, onClick }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return

    if (videoRef.current.paused) {
      videoRef.current.play()
    } else {
      videoRef.current.pause()
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [])

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        controls
        preload="metadata"
        className={className}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.(e)
        }}
      />
      {!isPlaying && (
        <button
          className="video-play-button"
          onClick={togglePlay}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}
    </>
  )
}

