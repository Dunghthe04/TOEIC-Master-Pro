import { useEffect, useRef, useState } from 'react'
import { Howl } from 'howler'
import { Button } from '@/components/ui/button'
import { Pause, Play } from 'lucide-react'

type Props = {
    src: string | null | undefined
}

export default function AudioPlayer({ src }: Props) {
    const howlRef = useRef<Howl | null>(null)
    const [playing, setPlaying] = useState(false)
    const [ready, setReady] = useState(false)

    useEffect(() => {
        // Cleanup player cũ mỗi khi đổi URL
        howlRef.current?.unload()
        howlRef.current = null
        setPlaying(false)
        setReady(false)

        if (!src) return

        const sound = new Howl({
            src: [src],
            html5: true, // stream URL tốt hơn với file dài
            onload: () => setReady(true),
            onend: () => setPlaying(false),
            onloaderror: () => setReady(false),
        })
        howlRef.current = sound

        return () => {
            sound.unload()
        }
    }, [src])

    if (!src) {
        return <p className="text-sm text-muted-foreground">Không có file audio.</p>
    }

    const toggle = () => {
        const sound = howlRef.current
        if (!sound) return
        if (sound.playing()) {
            sound.pause()
            setPlaying(false)
        } else {
            sound.play()
            setPlaying(true)
        }
    }

    return (
        <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!ready}
                onClick={toggle}
            >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <span className="text-sm text-muted-foreground truncate">
                {ready ? (playing ? 'Đang phát...' : 'Sẵn sàng nghe') : 'Đang tải audio...'}
            </span>
        </div>
    )
}