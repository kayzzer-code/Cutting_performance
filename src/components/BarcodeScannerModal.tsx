import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, ScanBarcode, X } from 'lucide-react'
import type { IScannerControls } from '@zxing/browser'

interface BarcodeScannerModalProps {
  onClose: () => void
  onDetected: (barcode: string) => void
}

export function BarcodeScannerModal({ onClose, onDetected }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDetectedRef = useRef(onDetected)
  const onCloseRef = useRef(onClose)
  const [status, setStatus] = useState('Initialisation de la caméra…')
  const [failed, setFailed] = useState(false)

  useEffect(() => { onDetectedRef.current = onDetected }, [onDetected])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])
  useEffect(() => {
    let controls: IScannerControls | undefined
    let cancelled = false
    let detected = false
    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (!videoRef.current || cancelled) return
        const reader = new BrowserMultiFormatReader()
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          videoRef.current,
          (result) => {
            if (!result || detected || cancelled) return
            const value = result.getText().replace(/\D/g, '')
            if (!value) return
            detected = true
            controls?.stop()
            setStatus('Code détecté : ' + value)
            onDetectedRef.current(value)
          },
        )
        if (!cancelled) setStatus('Place le code-barres dans le cadre')
      } catch {
        if (!cancelled) {
          setFailed(true)
          setStatus('Caméra indisponible ou autorisation refusée. Utilise la saisie manuelle du code-barres.')
        }
      }
    }
    void start()
    return () => { cancelled = true; controls?.stop() }
  }, [])

  return <div className="modal-backdrop scanner-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="barcode-scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
      <button className="modal-close" type="button" aria-label="Fermer le scanner" onClick={onClose} autoFocus><X /></button>
      <span className="scanner-title-icon"><ScanBarcode /></span>
      <h2 id="scanner-title">Scanner un produit</h2>
      <p>Autorise la caméra, puis présente le code-barres horizontalement dans le cadre.</p>
      <div className={'scanner-video-shell ' + (failed ? 'failed' : '')}>
        <video ref={videoRef} muted playsInline aria-label="Aperçu de la caméra" />
        <span className="scanner-guide" aria-hidden="true" />
        {failed && <CameraOff aria-hidden="true" />}
      </div>
      <div className="scanner-status" role="status" aria-live="polite">{failed ? <CameraOff /> : <Camera />}{status}</div>
      <button className="outline-teal-action scanner-manual-action" type="button" onClick={onClose}>Saisir le code manuellement</button>
    </section>
  </div>
}
