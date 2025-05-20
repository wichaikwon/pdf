'use client'

import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { PDFDocument } from 'pdf-lib'
import Link from 'next/link'

export default function HomePage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const sigCanvasRef = useRef<SignatureCanvas | null>(null)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0]
    if (file && file.type === 'application/pdf') {
      setPdfFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleClear = () => {
    if (sigCanvasRef.current) {
      sigCanvasRef.current.clear()
    }
  }

  const handleSave = async () => {
    if (!pdfFile) return

    if (!sigCanvasRef.current) return
    const sigDataUrl = sigCanvasRef.current
      .getTrimmedCanvas()
      .toDataURL('image/png')
    const existingPdfBytes = await pdfFile.arrayBuffer()
    const pdfDoc = await PDFDocument.load(existingPdfBytes)

    const pages = pdfDoc.getPages()
    const firstPage = pages[0]

    const pngImage = await pdfDoc.embedPng(sigDataUrl)
    const pngDims = pngImage.scale(0.5)

    firstPage.drawImage(pngImage, {
      x: 50,
      y: 50,
      width: pngDims.width,
      height: pngDims.height,
    })

    const pdfBytes = await pdfDoc.save()

    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = 'signed.pdf'
    a.click()
  }

  return (
    <div className="p-8">
      <nav>
      <ul className="list-none p-0 flex gap-2">
        <li>
        <Link href="/" className="text-blue-600 hover:underline">
          Home
        </Link>
        </li>
        <li>
        <Link href="/canvas" className="text-blue-600 hover:underline">
          Canvas
        </Link>
        </li>
      </ul>
      </nav>
      <h1 className="text-2xl font-bold mt-4 mb-4">อัปโหลด PDF แล้วเซ็น</h1>
      <input
      type="file"
      accept="application/pdf"
      onChange={handleUpload}
      className="block mb-4"
      />

      {previewUrl && (
      <>
        <h2 className="text-xl font-semibold mt-8 mb-2">Preview PDF</h2>
        <iframe
        src={previewUrl}
        width="100%"
        height="500px"
        className="border border-gray-300 w-full"
        />

        <h2 className="text-xl font-semibold mt-8 mb-2">ลายเซ็นของคุณ</h2>
        <SignatureCanvas
        ref={sigCanvasRef}
        canvasProps={{
          width: 500,
          height: 200,
          className: 'sigCanvas border border-black rounded',
          style: { width: '100%', maxWidth: 500, height: 200 },
        }}
        />
        <div className="mt-4 flex gap-4">
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          ล้างลายเซ็น
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          บันทึก PDF พร้อมลายเซ็น
        </button>
        </div>
      </>
      )}
    </div>
  )
}
