import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, CameraOff, Focus, ImageUp, ScanBarcode, SwitchCamera, X, Zap, ZoomIn } from 'lucide-react'
import type { IScannerControls } from '@zxing/browser'

interface BarcodeScannerModalProps {
  onClose: () => void
  onDetected: (barcode: string) => void
  onManual?: () => void
}

interface CameraCapabilities extends MediaTrackCapabilities {
  focusMode?: string[]
  torch?: boolean
  zoom?: { min: number; max: number; step?: number }
}

interface AdvancedCameraConstraints extends MediaTrackConstraintSet {
  focusMode?: string
  torch?: boolean
  zoom?: number
}

interface ZoomRange {
  min: number
  max: number
  step: number
}

const CAMERA_KEY = 'cutting-performance-app:preferred-camera'

function savedCamera() {
  try { return localStorage.getItem(CAMERA_KEY) ?? '' } catch { return '' }
}

function rememberCamera(deviceId: string) {
  try {
    if (deviceId) localStorage.setItem(CAMERA_KEY, deviceId)
    else localStorage.removeItem(CAMERA_KEY)
  } catch { /* Camera selection remains valid for this scan. */ }
}

async function applyCameraConstraints(track: MediaStreamTrack, advanced: AdvancedCameraConstraints) {
  await track.applyConstraints({ ...track.getConstraints(), advanced: [advanced as MediaTrackConstraintSet] })
}

export function BarcodeScannerModal({ onClose, onDetected, onManual = onClose }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const controlsRef = useRef<IScannerControls>(undefined)
  const trackRef = useRef<MediaStreamTrack>(undefined)
  const focusModeRef = useRef<string>(undefined)
  const focusModesRef = useRef<string[]>([])
  const onDetectedRef = useRef(onDetected)
  const onCloseRef = useRef(onClose)
  const [status, setStatus] = useState('Initialisation de la caméra…')
  const [failed, setFailed] = useState(false)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState(savedCamera)
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null)
  const [zoom, setZoom] = useState(1)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [focusAvailable, setFocusAvailable] = useState(false)

  function deliverResult(rawValue: string) {
    const value = rawValue.replace(/\D/g, '')
    if (!/^\d{8,14}$/.test(value)) return false
    controlsRef.current?.stop()
    setStatus('Code détecté : ' + value)
    onDetectedRef.current(value)
    return true
  }

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
      setFailed(false)
      setTorchAvailable(false)
      setTorchOn(false)
      setFocusAvailable(false)
      setZoomRange(null)
      setStatus('Initialisation de la caméra…')
      trackRef.current = undefined
      focusModeRef.current = undefined
      focusModesRef.current = []
      try {
        const { BrowserCodeReader, BrowserMultiFormatOneDReader } = await import('@zxing/browser')
        if (!videoRef.current || cancelled) return
        const reader = new BrowserMultiFormatOneDReader(undefined, { delayBetweenScanAttempts: 220 })
        const videoConstraints: MediaTrackConstraints = selectedCamera
          ? { deviceId: { exact: selectedCamera }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } }
        controls = await reader.decodeFromConstraints(
          { video: videoConstraints, audio: false },
          videoRef.current,
          (result) => {
            if (!result || detected || cancelled) return
            if (deliverResult(result.getText())) detected = true
          },
        )
        if (cancelled) { controls.stop(); return }
        controlsRef.current = controls

        const stream = videoRef.current.srcObject as MediaStream | null
        const track = stream?.getVideoTracks()[0]
        if (track) {
          trackRef.current = track
          const capabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() as CameraCapabilities : {}
          const focusModes = capabilities.focusMode ?? []
          focusModesRef.current = focusModes
          const focusMode = focusModes.includes('continuous') ? 'continuous' : focusModes.includes('single-shot') ? 'single-shot' : undefined
          focusModeRef.current = focusMode
          setFocusAvailable(Boolean(focusMode))

          const range = capabilities.zoom
          let initialZoom: number | undefined
          if (range && Number.isFinite(range.min) && Number.isFinite(range.max) && range.max > range.min) {
            const currentZoom = track.getSettings().zoom ?? range.min
            initialZoom = Math.min(range.max, Math.max(range.min, Math.max(currentZoom, Math.min(2, range.max))))
            setZoomRange({ min: range.min, max: range.max, step: Math.max(range.step ?? 0.1, 0.1) })
            setZoom(initialZoom)
          }
          if (focusMode || initialZoom !== undefined) {
            try { await applyCameraConstraints(track, { ...(focusMode ? { focusMode } : {}), ...(initialZoom !== undefined ? { zoom: initialZoom } : {}) }) } catch { /* Optional hardware controls. */ }
          }
        }

        setTorchAvailable(Boolean(controls.switchTorch))
        try {
          const devices = await BrowserCodeReader.listVideoInputDevices()
          if (!cancelled) setCameras(devices)
        } catch { if (!cancelled) setCameras([]) }
        if (!cancelled) setStatus('Cadre le code, recule légèrement et utilise le zoom si nécessaire')
      } catch {
        if (cancelled) return
        if (selectedCamera) {
          rememberCamera('')
          setSelectedCamera('')
          setStatus('Cet objectif n’est plus disponible. Retour à la caméra arrière automatique…')
          return
        }
        setFailed(true)
        setStatus('Caméra indisponible ou autorisation refusée. Essaie une photo nette ou la saisie manuelle.')
      }
    }
    void start()
    return () => {
      cancelled = true
      controls?.stop()
      if (controlsRef.current === controls) controlsRef.current = undefined
      trackRef.current = undefined
    }
  }, [selectedCamera])

  async function changeZoom(next: number) {
    setZoom(next)
    const track = trackRef.current
    if (!track) return
    try {
      await applyCameraConstraints(track, { ...(focusModeRef.current ? { focusMode: focusModeRef.current } : {}), zoom: next })
      setStatus(`Zoom ${next.toFixed(1).replace('.0', '')}× — garde le code net dans le cadre`)
    } catch { setStatus('Le zoom n’a pas pu être appliqué sur cette caméra.') }
  }

  async function refocus() {
    const track = trackRef.current
    if (!track || !focusModeRef.current) return
    try {
      const requestedMode = focusModesRef.current.includes('single-shot') ? 'single-shot' : focusModeRef.current
      await applyCameraConstraints(track, { focusMode: requestedMode, ...(zoomRange ? { zoom } : {}) })
      setStatus('Mise au point relancée — garde le téléphone immobile un instant')
    } catch { setStatus('La mise au point manuelle n’est pas disponible sur cet objectif.') }
  }

  async function toggleTorch() {
    const next = !torchOn
    try {
      await controlsRef.current?.switchTorch?.(next)
      setTorchOn(next)
      setStatus(next ? 'Lampe allumée — évite les reflets directs sur l’emballage' : 'Lampe éteinte')
    } catch { setStatus('La lampe n’est pas disponible sur cette caméra.') }
  }

  async function decodePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setStatus('Analyse de la photo haute définition…')
    const url = URL.createObjectURL(file)
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const result = await new BrowserMultiFormatReader(undefined, { tryPlayVideoTimeout: 8000 }).decodeFromImageUrl(url)
      if (!deliverResult(result.getText())) throw new Error('Code produit invalide')
    } catch {
      setStatus('Code non détecté sur la photo. Cadre uniquement le code, sans reflet, puis réessaie.')
    } finally { URL.revokeObjectURL(url) }
  }

  return <div className="modal-backdrop scanner-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="barcode-scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
      <button className="modal-close" type="button" aria-label="Fermer le scanner" onClick={onClose} autoFocus><X /></button>
      <span className="scanner-title-icon"><ScanBarcode /></span>
      <h2 id="scanner-title">Scanner un produit</h2>
      <p>Présente le code horizontalement. Pour un petit code, reste à une distance où il est net puis augmente le zoom.</p>
      <div className={'scanner-video-shell ' + (failed ? 'failed' : '')}>
        <video ref={videoRef} muted playsInline aria-label="Aperçu de la caméra" />
        <span className="scanner-guide" aria-hidden="true" />
        {failed && <CameraOff aria-hidden="true" />}
      </div>
      <div className="scanner-status" role="status" aria-live="polite">{failed ? <CameraOff /> : <Camera />}{status}</div>
      {!failed && <div className="scanner-camera-controls">
        {cameras.length > 1 && <label className="scanner-camera-select"><span><SwitchCamera /> Objectif</span><select aria-label="Choisir la caméra" value={selectedCamera} onChange={(event) => { rememberCamera(event.target.value); setSelectedCamera(event.target.value) }}><option value="">Arrière automatique</option>{cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Caméra ${index + 1}`}</option>)}</select></label>}
        {zoomRange && <label className="scanner-zoom"><span><ZoomIn /> Zoom <strong>{zoom.toFixed(1).replace('.0', '')}×</strong></span><input aria-label="Zoom de la caméra" type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step} value={zoom} onChange={(event) => void changeZoom(Number(event.target.value))} /></label>}
        {(focusAvailable || torchAvailable) && <div className="scanner-tool-row">
          {focusAvailable && <button type="button" onClick={() => void refocus()}><Focus /> Refaire le point</button>}
          {torchAvailable && <button type="button" aria-pressed={torchOn} onClick={() => void toggleTorch()}><Zap /> {torchOn ? 'Éteindre' : 'Éclairer'}</button>}
        </div>}
      </div>}
      <div className="scanner-fallback-actions">
        <input ref={photoRef} className="scanner-photo-input" type="file" accept="image/*" capture="environment" aria-label="Prendre ou importer une photo du code-barres" onChange={(event) => void decodePhoto(event)} />
        <button className="outline-teal-action" type="button" onClick={() => photoRef.current?.click()}><ImageUp /> Photo nette</button>
        <button className="outline-teal-action scanner-manual-action" type="button" onClick={onManual}>Saisir le code manuellement</button>
      </div>
    </section>
  </div>
}
