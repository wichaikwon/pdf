'use client'
import React, { useEffect, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import Link from 'next/link'
import { saveAs } from 'file-saver'
const App: React.FC = () => {
  const [pdfjsLib, setPdfjsLib] = useState<typeof import('pdfjs-dist') | null>(
    null
  )
  const [pdfDoc, setPdfDoc] = useState<
    import('pdfjs-dist').PDFDocumentProxy | null
  >(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(0)
  const [images, setImages] = useState<
    Array<{
      id: string
      x: number
      y: number
      width: number
      height: number
      src: string
    }>
  >([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizingImage, setResizingImage] = useState<string | null>(null)
  const [resizeStart, setResizeStart] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<{
    cancel: () => void
    promise: Promise<unknown>
  } | null>(null)
  useEffect(() => {
    import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()
      setPdfjsLib(pdfjs)
    })
  }, [])

  const startResize = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const img = images.find((img) => img.id === id)
    if (!img) return
    setResizingImage(id)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: img.width,
      height: img.height,
    })
  }

  const stopResize = () => {
    setResizingImage(null)
    setResizeStart(null)
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file || !pdfjsLib) {
      alert('Please upload a valid PDF file.')
      return
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument(arrayBuffer)
      const pdf = await loadingTask.promise
      setPdfDoc(pdf)
      setTotalPages(pdf.numPages)
      setCurrentPage(1)
      setImages([])
    } catch (error) {
      console.error('Error loading PDF:', error)
      alert('Failed to load PDF. Please try another file.')
    }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.match('image.*')) {
      alert('Please upload a valid image file.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const newImage = {
          id: `img-${Date.now()}`,
          x: 100,
          y: 100,
          width: img.width / 2,
          height: img.height / 2,
          src: e.target?.result as string,
        }
        setImages([...images, newImage])
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const renderPage = async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current || pageNum < 1 || pageNum > totalPages)
      return

    try {
      const page = await pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      canvas.height = viewport.height
      canvas.width = viewport.width

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }

      const renderTask = page.render({
        canvasContext: context!,
        viewport: viewport,
      })
      renderTaskRef.current = renderTask

      await renderTask.promise

      images.forEach((img) => {
        const imgElement = new Image()
        imgElement.src = img.src
        context?.drawImage(imgElement, img.x, img.y, img.width, img.height)
      })
    } catch (error: unknown) {
      if (
        (error as { name?: string })?.name !== 'RenderingCancelledException'
      ) {
        console.error('Error rendering page:', error)
      }
    }
  }

  const startDrag = (e: React.MouseEvent, id: string) => {
    const img = images.find((img) => img.id === id)
    if (!img) return

    setIsDragging(true)
    setSelectedImage(id)
    setDragOffset({
      x: e.clientX - img.x,
      y: e.clientY - img.y,
    })
    e.stopPropagation()
  }

  const onDrag = (e: React.MouseEvent) => {
    if (!isDragging || !selectedImage) return

    setImages(
      images.map((img) => {
        if (img.id === selectedImage) {
          return {
            ...img,
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y,
          }
        }
        return img
      })
    )
  }

  const stopDrag = () => {
    setIsDragging(false)
    setSelectedImage(null)
  }

  const onResize = (e: React.MouseEvent) => {
    if (!resizingImage || !resizeStart) return

    setImages(
      images.map((img) => {
        if (img.id === resizingImage) {
          const newWidth = Math.max(
            10,
            resizeStart.width + (e.clientX - resizeStart.x)
          )
          const newHeight = Math.max(
            10,
            resizeStart.height + (e.clientY - resizeStart.y)
          )
          return {
            ...img,
            width: newWidth,
            height: newHeight,
          }
        }
        return img
      })
    )
  }

  const savePdfWithImages = async () => {
    if (!pdfDoc || images.length === 0) {
      alert('No PDF or images to save')
      return
    }

    try {
      const originalPdfBytes = await pdfDoc.getData()
      const pdfDocLib = await PDFDocument.load(originalPdfBytes)
      const page = await pdfDoc.getPage(currentPage)
      const viewport = page.getViewport({ scale: 1.5 })

      for (let i = 0; i < pdfDocLib.getPageCount(); i++) {
        const pdfPage = pdfDocLib.getPage(i)
        const { width, height } = pdfPage.getSize()

        const scaleX = width / viewport.width
        const scaleY = height / viewport.height

        for (const img of images) {
          const imageBytes = await fetch(img.src).then((res) =>
            res.arrayBuffer()
          )
          const image = await pdfDocLib.embedPng(imageBytes)

          pdfPage.drawImage(image, {
            x: img.x * scaleX,
            y: height - img.y * scaleY - img.height * scaleY,
            width: img.width * scaleX,
            height: img.height * scaleY,
          })
        }
      }

      const newPdfBytes = await pdfDocLib.save()
      const blob = new Blob([newPdfBytes], { type: 'application/pdf' })
      saveAs(blob, 'modified.pdf')
    } catch (error) {
      console.error('Error saving PDF:', error)
      alert('Failed to save PDF')
    }
  }

  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage)
    }
  }, [pdfDoc, currentPage, images])

  const goToPreviousPage = (e: React.MouseEvent) => {
    e.preventDefault()
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const goToNextPage = (e: React.MouseEvent) => {
    e.preventDefault()
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }
  const getTouchPos = (e: React.TouchEvent) => {
    const touch = e.touches[0] || e.changedTouches[0]
    return { x: touch.clientX, y: touch.clientY }
  }

  const startDragTouch = (e: React.TouchEvent, id: string) => {
    const pos = getTouchPos(e)
    const img = images.find((img) => img.id === id)
    if (!img) return
    setIsDragging(true)
    setSelectedImage(id)
    setDragOffset({
      x: pos.x - img.x,
      y: pos.y - img.y,
    })
    e.stopPropagation()
  }

  const onDragTouch = (e: React.TouchEvent) => {
    if (!isDragging || !selectedImage) return
    const pos = getTouchPos(e)
    setImages(
      images.map((img) => {
        if (img.id === selectedImage) {
          return {
            ...img,
            x: pos.x - dragOffset.x,
            y: pos.y - dragOffset.y,
          }
        }
        return img
      })
    )
  }

  const stopDragTouch = () => {
    setIsDragging(false)
    setSelectedImage(null)
  }

  const startResizeTouch = (e: React.TouchEvent, id: string) => {
    e.stopPropagation()
    const pos = getTouchPos(e)
    const img = images.find((img) => img.id === id)
    if (!img) return
    setResizingImage(id)
    setResizeStart({
      x: pos.x,
      y: pos.y,
      width: img.width,
      height: img.height,
    })
  }

  const onResizeTouch = (e: React.TouchEvent) => {
    if (!resizingImage || !resizeStart) return
    const pos = getTouchPos(e)
    setImages(
      images.map((img) => {
        if (img.id === resizingImage) {
          const newWidth = Math.max(
            10,
            resizeStart.width + (pos.x - resizeStart.x)
          )
          const newHeight = Math.max(
            10,
            resizeStart.height + (pos.y - resizeStart.y)
          )
          return { ...img, width: newWidth, height: newHeight }
        }
        return img
      })
    )
  }

  const stopResizeTouch = () => {
    setResizingImage(null)
    setResizeStart(null)
  }
  return (
    <div className="p-5 max-w-3xl mx-auto">
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
      <h1 className="text-2xl font-bold my-4">PDF Viewer with PNG</h1>
      <div className="mb-5 flex flex-wrap gap-2 items-center">
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          ref={fileInputRef}
          className="file:mr-2"
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          ref={imageInputRef}
          className="file:mr-2"
        />
        <button
          onClick={savePdfWithImages}
          disabled={!pdfDoc || images.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
        >
          Save PDF with Images
        </button>
      </div>
      {pdfDoc ? (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:bg-gray-100"
            >
              Previous
            </button>
            <span className="mx-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 bg-gray-200 rounded disabled:bg-gray-100"
            >
              Next
            </button>
          </div>
          <div
            ref={containerRef}
            className="relative border border-gray-300 overflow-auto max-h-[80vh] touch-none"
            onMouseMove={(e) => {
              onDrag(e)
              onResize(e)
            }}
            onMouseUp={() => {
              stopDrag()
              stopResize()
            }}
            onMouseLeave={() => {
              stopDrag()
              stopResize()
            }}
            onTouchMove={(e) => {
              onDragTouch(e)
              onResizeTouch(e)
            }}
            onTouchEnd={() => {
              stopDragTouch()
              stopResizeTouch()
            }}
            onTouchCancel={() => {
              stopDragTouch()
              stopResizeTouch()
            }}
          >
            <canvas ref={canvasRef} className="block" />
            {images.map((img) => (
              <React.Fragment key={img.id}>
                <img
                  id={img.id}
                  src={img.src}
                  style={{
                    position: 'absolute',
                    left: img.x,
                    top: img.y,
                    width: img.width,
                    height: img.height,
                    cursor: 'move',
                    border:
                      selectedImage === img.id ? '2px dashed #2563eb' : 'none',
                    pointerEvents: 'auto',
                    touchAction: 'none',
                  }}
                  onMouseDown={(e) => startDrag(e, img.id)}
                  onTouchStart={(e) => startDragTouch(e, img.id)}
                  alt="Draggable PNG"
                  draggable={false}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: img.x + img.width - 10,
                    top: img.y + img.height - 10,
                    width: 16,
                    height: 16,
                    background: '#2563eb',
                    borderRadius: 4,
                    cursor: 'nwse-resize',
                    zIndex: 10,
                    touchAction: 'none',
                  }}
                  onMouseDown={(e) => startResize(e, img.id)}
                  onTouchStart={(e) => startResizeTouch(e, img.id)}
                />
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-gray-300 p-10 text-center text-gray-500">
          Select a PDF file to view
        </div>
      )}
    </div>
  )
}

export default App
