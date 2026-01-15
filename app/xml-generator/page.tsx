'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    JsBarcode: any
    QRCode: any
    JSZip: any
    qrCodeTasks?: Array<{ id: string; text: string }>
  }
}

export default function XMLGeneratorPage() {
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('')
  const [division, setDivision] = useState('')
  const [vendorCode, setVendorCode] = useState('')
  const [itemNumber, setItemNumber] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [prepackVendorCode, setPrepackVendorCode] = useState('')
  const [generatedXmls, setGeneratedXmls] = useState<string[]>([])
  const [xmlOutput, setXmlOutput] = useState('')
  const [labelPreview, setLabelPreview] = useState('')
  const [showLabelSection, setShowLabelSection] = useState(false)
  const [scriptsLoaded, setScriptsLoaded] = useState({
    jsbarcode: false,
    qrcode: false,
    jszip: false,
  })

  // Division mappings
  const divisionPrepackMap: Record<string, string> = {
    '3960': '3301011799', // Powertools
    'AID': '77779',       // KIT
    'HERV': '77778',      // Herverpakking
  }

  const divisionVendorMap: Record<string, string> = {
    '3960': '3300009627', // Powertools
    'AID': '25002',       // KIT
    'HERV': '25002',      // Herverpakking
  }

  const divisionXmlMap: Record<string, string> = {
    '3960': '3960',      // Powertools blijft 3960
    'AID': 'AID',        // KIT blijft AID
    'HERV': 'AID',       // Herverpakking moet AID in XML worden
  }

  // Set delivery date to today + 3 days
  useEffect(() => {
    const today = new Date()
    const deliveryDate = new Date(today)
    deliveryDate.setDate(today.getDate() + 3)

    const year = deliveryDate.getFullYear()
    const month = String(deliveryDate.getMonth() + 1).padStart(2, '0')
    const day = String(deliveryDate.getDate()).padStart(2, '0')

    setDeliveryDate(`${year}-${month}-${day}`)
  }, [])

  // Update vendor codes when division changes
  useEffect(() => {
    if (division) {
      if (divisionPrepackMap[division]) {
        setPrepackVendorCode(divisionPrepackMap[division])
      }
      if (divisionVendorMap[division]) {
        setVendorCode(divisionVendorMap[division])
      }
    } else {
      setPrepackVendorCode('')
      setVendorCode('')
    }
  }, [division])

  const generateRandomNumberString = (length: number): string => {
    let result = ''
    const characters = '0123456789'
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return result
  }

  const generateSingleXML = (index: number = 0, totalQuantity: number = 1): string => {
    let poNumber = purchaseOrderNumber

    // Als er meer dan 1 stuk is, voeg volgnummer toe
    if (totalQuantity > 1) {
      const sequenceNumber = String(index + 1).padStart(3, '0')
      poNumber = `${sequenceNumber}${poNumber}`
    }

    const xmlDivision = divisionXmlMap[division] || division
    const unitOf = 'PC  ' // Standaardwaarde met spaties
    const location = 'FPTD' // Standaardwaarde
    const deliveryTimeFrameCode = '00   ' // Standaardwaarde met spaties
    const dueDate = deliveryDate // Zelfde als leveringsdatum
    const dueTimeFrameCode = '00   ' // Standaardwaarde met spaties

    // Datum en tijd voor ActionDateTime
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const milliseconds = String(now.getMilliseconds()).padStart(6, '0')
    const actionDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds.substring(0, 6)}`

    // XML opbouwen
    let xml = '<?xml version="1.0" encoding="utf-8"?>'
    xml += '<BE2NET_PO_PREPACK_START>'
    xml += `<PurchaseOrderNumber>${poNumber}</PurchaseOrderNumber>`
    xml += `<Division>${xmlDivision}</Division>`
    xml += `<VendorCode>${vendorCode}</VendorCode>`
    xml += `<ItemNumber>${itemNumber}</ItemNumber>`
    xml += `<Quantity>1</Quantity>` // Altijd 1, want we maken per stuk
    xml += `<UnitOf>${unitOf}</UnitOf>`
    xml += `<Location>${location}</Location>`
    xml += `<DeliveryDate>${deliveryDate}</DeliveryDate>`
    xml += `<DeliveryTimeFrame><Code>${deliveryTimeFrameCode}</Code><From /><To /></DeliveryTimeFrame>`
    xml += `<DueDate>${dueDate}</DueDate>`
    xml += `<DueTimeFrame><Code>${dueTimeFrameCode}</Code><From /><To /></DueTimeFrame>`
    xml += `<PrepackVendorCode>${prepackVendorCode}</PrepackVendorCode>`
    xml += `<ActionDateTime>${actionDateTime}</ActionDateTime>`
    xml += '</BE2NET_PO_PREPACK_START>'

    return xml
  }

  const generateXMLs = (): string[] => {
    const xmls: string[] = []

    // Genereer een XML voor elk stuk
    for (let i = 0; i < quantity; i++) {
      xmls.push(generateSingleXML(i, quantity))
    }

    return xmls
  }

  const handleGenerateXML = () => {
    if (!purchaseOrderNumber || !division || !itemNumber) {
      alert('Vul alle verplichte velden in')
      return
    }

    const xmls = generateXMLs()
    setGeneratedXmls(xmls)

    // Toon aantal en eerste XML in de output
    const outputText = `${xmls.length} XML(s) gegenereerd.\n\nXML 1 van ${xmls.length}:\n${xmls[0]}${
      xmls.length > 1 ? `\n\n... ${xmls.length - 1} meer XML(s) worden niet getoond ...` : ''
    }`

    setXmlOutput(outputText)
  }

  const generateBarcode = (text: string, width: number = 2, height: number = 50): string => {
    if (!window.JsBarcode) {
      return `<div style="font-family: monospace; font-size: 8px; text-align: center;">|||||||||||||||||||</div>`
    }

    try {
      const canvas = document.createElement('canvas')
      window.JsBarcode(canvas, text, {
        format: 'CODE128',
        width: width,
        height: height,
        displayValue: false,
        margin: 0,
      })

      return `<img src="${canvas.toDataURL()}" style="max-width: 100%; height: auto;" alt="Barcode: ${text}">`
    } catch (error) {
      console.warn('Barcode generatie gefaald voor:', text, error)
      return `<div style="font-family: monospace; font-size: 8px; text-align: center;">|||||||||||||||||||</div>`
    }
  }

  const generateBarcodeWithPrefix = (prefix: string, text: string, width: number = 2, height: number = 50): string => {
    const barcodeData = `${prefix}${text}`
    return generateBarcode(barcodeData, width, height)
  }

  const getCurrentDate = (): string => {
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = now.getFullYear()
    return `${day}/${month}/${year}`
  }

  const generateLabel = (parcelIndex: number = 0): string => {
    const labelQuantity = '1'
    const currentDate = getCurrentDate()

    // Random nummers genereren
    const deliveryNotice = generateRandomNumberString(6)
    const randomParcelSuffix = generateRandomNumberString(3)
    const shopOrder = '000000' // Blijft placeholder

    // Prefixen toevoegen
    const prefixedPO = `K${purchaseOrderNumber}`
    const prefixedItem = `P${itemNumber}`
    const prefixedSupplier = `V${prepackVendorCode}`
    const prefixedQuantity = `Q${labelQuantity}`

    // Parcel nummer met random deel
    const parcelNumber = `${prepackVendorCode}${randomParcelSuffix}01`

    // Barcodes
    const poBarcode = generateBarcodeWithPrefix('K', purchaseOrderNumber, 1.8, 30)
    const partBarcode = generateBarcodeWithPrefix('P', itemNumber, 1.8, 30)
    const supplierBarcode = generateBarcodeWithPrefix('V', prepackVendorCode, 1.8, 25)
    const quantityBarcode = generateBarcodeWithPrefix('Q', labelQuantity, 1.5, 20)
    const fptdBarcode = generateBarcodeWithPrefix('2L', 'FPTD', 1.2, 25)
    const deliveryNoticeBarcode = generateBarcodeWithPrefix('H', deliveryNotice, 1.2, 20)
    const shopOrderBarcode = generateBarcodeWithPrefix('2W', shopOrder, 1.2, 20)
    const parcelBarcode = generateBarcodeWithPrefix('S', parcelNumber, 1.8, 25)

    // Data voor QR code
    const qrCodeData = `DPTD/${encodeURIComponent(prefixedPO)}/${encodeURIComponent(prefixedItem)}/${encodeURIComponent(prefixedQuantity)}/${encodeURIComponent(prefixedSupplier)}/S${encodeURIComponent(parcelNumber)}/H${encodeURIComponent(deliveryNotice)}/2W${encodeURIComponent(shopOrder)}/2LFPTD`

    const labelHTML = `
      <table class="label-table">
        <tr style="height: 15%;">
          <td class="label-header-left">
            RECEIVER<br>
            <strong>ATLAS COPCO</strong> &nbsp;&nbsp;&nbsp;&nbsp; PTD<br>
            ATLAS COPCO POWER TOOLS DISTR. NV
          </td>
          <td class="label-header-right">
            <div class="label-destination-text">Destination: (2L)</div>
            <div class="label-destination-barcode">${fptdBarcode}</div>
            <div class="label-fptd-text">FPTD</div>
          </td>
        </tr>
        <tr style="height: 20%;">
          <td class="label-po-left" colspan="2"> 
            <div class="label-po-label">PO Line: (K)</div>
            <div class="label-po-number">${prefixedPO}</div>
            <div class="label-po-barcode">${poBarcode}</div>
          </td>
        </tr>
        <tr style="height: 20%;">
          <td class="label-part-left" colspan="2"> 
            <div class="label-part-label">Part nr.: (P)</div>
            <div class="label-part-number">${prefixedItem}</div>
            <div class="label-part-barcode">${partBarcode}</div>
          </td>
        </tr>
        <tr style="height: 15%;">
          <td class="label-qty-left">
            <div class="label-qty-label">Quantity: (Q)</div>
            <div class="label-qty-number">${prefixedQuantity}</div>
            <div class="label-qty-barcode">${quantityBarcode}</div>
          </td>
          <td class="label-info-right">
            <div class="label-info-code">Delivery Notice nr.: (H)</div>
            <div class="label-info-number">${deliveryNotice}</div>
            <div class="label-info-barcode">${deliveryNoticeBarcode}</div>
          </td>
        </tr>
        <tr style="height: 15%;">
          <td class="label-supplier-left">
            <div class="label-supplier-label">Supplier code: (V)</div>
            <div class="label-supplier-number">${prefixedSupplier}</div>
            <div class="label-supplier-barcode">${supplierBarcode}</div>
          </td>
          <td class="label-info-right">
            <div class="label-info-code">Shop order: (2W)</div>
            <div class="label-info-number">${shopOrder}</div>
            <div class="label-info-barcode">${shopOrderBarcode}</div>
          </td>
        </tr>
        <tr style="height: 15%;">
          <td class="label-parcel-left">
            <div class="label-parcel-label">Parcel nr.: (S)</div>
            <div class="label-parcel-number">S${parcelNumber}</div>
            <div class="label-parcel-barcode">${parcelBarcode}</div>
          </td>
          <td class="label-date-section">
            <div class="label-date-text"><strong>Date</strong><br>D ${currentDate}</div>
            <div id="qrcode-${parcelIndex}" class="label-qr-code"></div>
          </td>
        </tr>
      </table>
    `

    // Store QR code task
    if (!window.qrCodeTasks) {
      window.qrCodeTasks = []
    }
    window.qrCodeTasks.push({ id: `qrcode-${parcelIndex}`, text: qrCodeData })

    return labelHTML
  }

  const handleGenerateLabel = () => {
    if (!purchaseOrderNumber || !division || !itemNumber) {
      alert('Vul alle verplichte velden in')
      return
    }

    if (division !== '3960') {
      alert('Labels zijn alleen beschikbaar voor Powertools divisie')
      return
    }

    let allLabelsHTML = ''
    if (!window.qrCodeTasks) {
      window.qrCodeTasks = []
    }
    window.qrCodeTasks = [] // Reset QR code taken

    for (let i = 0; i < quantity; i++) {
      const singleLabelHTML = generateLabel(i)
      allLabelsHTML += `<div class="label-print-page">${singleLabelHTML}</div>`
    }

    setLabelPreview(allLabelsHTML)
    setShowLabelSection(true)

    // Genereer QR codes nadat HTML is toegevoegd
    setTimeout(() => {
      if (window.qrCodeTasks && window.qrCodeTasks.length > 0 && window.QRCode) {
        window.qrCodeTasks.forEach((task: { id: string; text: string }) => {
          const qrElement = document.getElementById(task.id)
          if (qrElement) {
            qrElement.innerHTML = ''
            new window.QRCode(qrElement, {
              text: task.text,
              width: 90,
              height: 90,
              colorDark: '#000000',
              colorLight: '#ffffff',
              correctLevel: (window.QRCode as any).CorrectLevel?.H || 2,
            })
          }
        })
        window.qrCodeTasks = []
      }
    }, 100)
  }

  const handlePrintLabel = () => {
    if (!labelPreview) {
      alert('Genereer eerst een label om te printen.')
      return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Labels</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 5mm;
            }
            .label-print-page {
              width: 270mm;
              height: 180mm;
              border: 2px solid #000;
              background-color: white;
              margin: 0 auto 5mm auto;
              page-break-after: always;
              page-break-inside: avoid;
              position: relative;
            }
            .label-print-page:last-child {
              page-break-after: avoid;
            }
            .label-table {
              width: 100%;
              height: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            .label-table td {
              border: 2px solid #000;
              padding: 5px;
              vertical-align: top;
              position: relative;
            }
            .label-table img {
              max-width: 100%;
              height: auto;
              display: block;
              margin: 0 auto;
            }
            .label-qr-code {
              position: absolute;
              right: 5px;
              bottom: 5px;
              width: 90px;
              height: 90px;
            }
            .label-qr-code canvas,
            .label-qr-code img {
              width: 90px;
              height: 90px;
            }
            ${document.getElementById('label-styles')?.innerHTML || ''}
          </style>
        </head>
        <body>
          <div class="print-container">
            ${labelPreview}
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const downloadFile = (content: string | Blob, filename: string) => {
    const blob = new Blob([content], { type: content instanceof Blob ? content.type : 'text/xml' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  const handleDownload = () => {
    if (generatedXmls.length === 0) return

    const xmlDivision = divisionXmlMap[division] || division

    // Maak een .zip bestand als er meerdere XMLs zijn
    if (generatedXmls.length > 1) {
      if (!window.JSZip) {
        alert('JSZip library niet geladen. Probeer opnieuw.')
        return
      }

      const zip = new window.JSZip()
      const now = new Date()

      // Voeg elke XML toe aan het zip bestand
      generatedXmls.forEach((xml, index) => {
        const millisToAdd = index * 10
        const fileDate = new Date(now.getTime() + millisToAdd)

        const timestamp =
          fileDate.getFullYear() +
          String(fileDate.getMonth() + 1).padStart(2, '0') +
          String(fileDate.getDate()).padStart(2, '0') +
          String(fileDate.getHours()).padStart(2, '0') +
          String(fileDate.getMinutes()).padStart(2, '0') +
          String(fileDate.getSeconds()).padStart(2, '0') +
          String(fileDate.getMilliseconds()).padStart(4, '0')

        const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')
        const filename = `PROD_${xmlDivision}_${prepackVendorCode}_${timestamp}_Z${random}.xml`

        zip.file(filename, xml)
      })

      // Genereer het zip-bestand
      zip.generateAsync({ type: 'blob' }).then((content: Blob) => {
        const zipFilename = `XML_Export_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.zip`
        downloadFile(content, zipFilename)
      })
    } else {
      // Download enkele XML
      const xml = generatedXmls[0]
      const now = new Date()
      const timestamp =
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0') +
        String(now.getMilliseconds()).padStart(4, '0')

      const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')
      const filename = `PROD_${xmlDivision}_${prepackVendorCode}_${timestamp}_Z${random}.xml`

      downloadFile(xml, filename)
    }
  }

  const handleClear = () => {
    setPurchaseOrderNumber('')
    setDivision('')
    setItemNumber('')
    setQuantity(1)
    setXmlOutput('')
    setGeneratedXmls([])
    setShowLabelSection(false)
    setLabelPreview('')

    // Reset leveringsdatum
    const today = new Date()
    const deliveryDate = new Date(today)
    deliveryDate.setDate(today.getDate() + 3)
    const year = deliveryDate.getFullYear()
    const month = String(deliveryDate.getMonth() + 1).padStart(2, '0')
    const day = String(deliveryDate.getDate()).padStart(2, '0')
    setDeliveryDate(`${year}-${month}-${day}`)
  }

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"
        onLoad={() => {
          setScriptsLoaded((prev) => ({ ...prev, jsbarcode: true }))
          if (typeof window !== 'undefined') {
            window.JsBarcode = (window as any).JsBarcode
          }
        }}
      />
      <Script
        src="https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs/qrcode.min.js"
        onLoad={() => {
          setScriptsLoaded((prev) => ({ ...prev, qrcode: true }))
          if (typeof window !== 'undefined') {
            window.QRCode = (window as any).QRCode
          }
        }}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
        onLoad={() => {
          setScriptsLoaded((prev) => ({ ...prev, jszip: true }))
          if (typeof window !== 'undefined') {
            window.JSZip = (window as any).JSZip
          }
        }}
      />

      <style jsx global>{`
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .xml-container {
          max-width: 800px;
          margin: 0 auto;
          background-color: white;
          padding: 20px;
          border-radius: 5px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .form-group {
          margin-bottom: 15px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        input,
        select {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-sizing: border-box;
          font-size: 16px;
        }
        button {
          background-color: #4caf50;
          color: white;
          padding: 10px 15px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          min-height: 44px;
          touch-action: manipulation;
        }
        button:hover {
          background-color: #45a049;
        }
        button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        .output {
          margin-top: 20px;
          border: 1px solid #ddd;
          padding: 15px;
          background-color: #f9f9f9;
          border-radius: 4px;
        }
        .output pre {
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: space-between;
          margin-top: 20px;
        }
        .actions button {
          flex: 1;
          min-width: 150px;
        }
        .auto-field {
          background-color: #f0f0f0;
          color: #555;
          cursor: not-allowed;
        }
        .label-section {
          margin-top: 20px;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background-color: #f9f9f9;
        }
        .label-preview {
          width: 100%;
          max-width: 800px;
          margin: 20px auto;
          background-color: white;
          font-family: Arial, sans-serif;
          font-size: 10px;
        }
        .label-print-page {
          width: 100%;
          max-width: 800px;
          height: 560px;
          border: 3px solid #000;
          background-color: white;
          margin-bottom: 20px;
          position: relative;
          overflow: hidden;
        }
        .label-table {
          width: 100%;
          height: 100%;
          border-collapse: collapse;
        }
        .label-table td {
          border: 2px solid #000;
          padding: 5px;
          vertical-align: top;
          position: relative;
        }
        .label-header-left {
          width: 68%;
          font-weight: bold;
          font-size: 10px;
          line-height: 1.3;
        }
        .label-header-right {
          width: 32%;
          text-align: center;
          font-size: 10px;
        }
        .label-destination-text {
          font-size: 9px;
          margin-bottom: 5px;
          text-align: left;
          padding-left: 5px;
        }
        .label-destination-barcode {
          height: 25px;
          margin-bottom: 5px;
        }
        .label-fptd-text {
          font-size: 20px;
          font-weight: bold;
          text-align: right;
          padding-right: 10px;
        }
        .label-po-left {
          text-align: left;
          padding-left: 10px !important;
        }
        .label-po-label {
          font-size: 10px;
          margin-bottom: 5px;
        }
        .label-po-number {
          font-size: 26px;
          font-weight: bold;
          text-align: center;
          margin-top: 5px;
          margin-bottom: 5px;
        }
        .label-po-barcode {
          height: 30px;
          margin-top: 5px;
        }
        .label-part-left {
          text-align: left;
          padding-left: 10px !important;
        }
        .label-part-label {
          font-size: 10px;
          margin-bottom: 5px;
        }
        .label-part-number {
          font-size: 22px;
          font-weight: bold;
          text-align: center;
          margin-top: 5px;
          margin-bottom: 5px;
        }
        .label-part-barcode {
          height: 30px;
          margin-top: 5px;
        }
        .label-info-right {
          text-align: left;
          font-size: 9px;
          padding-left: 10px !important;
        }
        .label-info-code {
          margin-bottom: 2px;
        }
        .label-info-number {
          font-size: 16px;
          font-weight: bold;
          text-align: center;
          margin-top: 2px;
          margin-bottom: 2px;
        }
        .label-info-barcode {
          height: 25px;
          margin-top: 2px;
        }
        .label-qty-left {
          text-align: left;
          padding-left: 10px !important;
        }
        .label-qty-label {
          font-size: 10px;
          margin-bottom: 0px;
        }
        .label-qty-number {
          font-size: 30px;
          font-weight: bold;
          text-align: center;
          margin-top: 0px;
          margin-bottom: 0px;
        }
        .label-qty-barcode {
          height: 20px;
          margin-top: 0px;
          width: 50%;
          margin-left: auto;
          margin-right: auto;
        }
        .label-supplier-left {
          text-align: left;
          padding-left: 10px !important;
        }
        .label-supplier-label {
          font-size: 10px;
          margin-bottom: 2px;
        }
        .label-supplier-number {
          font-size: 16px;
          font-weight: bold;
          text-align: center;
          margin-top: 2px;
          margin-bottom: 2px;
        }
        .label-supplier-barcode {
          height: 25px;
          margin-top: 2px;
        }
        .label-parcel-left {
          text-align: left;
          padding-left: 10px !important;
        }
        .label-parcel-label {
          font-size: 10px;
          margin-bottom: 2px;
        }
        .label-parcel-number {
          font-size: 14px;
          font-weight: bold;
          text-align: center;
          margin-top: 2px;
          margin-bottom: 2px;
        }
        .label-parcel-barcode {
          height: 25px;
          margin-top: 2px;
        }
        .label-date-section {
          font-size: 9px;
          padding-left: 10px !important;
        }
        .label-date-text {
          margin-bottom: 3px;
        }
        .label-qr-code {
          position: absolute;
          right: 5px;
          bottom: 5px;
          width: 90px;
          height: 90px;
        }
        @media print {
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body > *:not(.print-container) {
            display: none !important;
          }
          .print-container {
            display: block !important;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            background: white;
          }
          @page {
            size: A4 landscape;
            margin: 5mm;
          }
          .label-print-page {
            width: 270mm !important;
            height: 180mm !important;
            border: 2px solid #000 !important;
            background-color: white !important;
            margin: 0 auto 5mm auto !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            position: relative !important;
            display: block !important;
          }
          .label-print-page:last-child {
            page-break-after: avoid !important;
          }
          .label-table {
            width: 100% !important;
            height: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          .label-table td {
            border: 2px solid #000 !important;
            padding: 5px !important;
            vertical-align: top !important;
            position: relative !important;
          }
          .label-table img {
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
            margin: 0 auto !important;
          }
          .label-qr-code {
            position: absolute !important;
            right: 5px !important;
            bottom: 5px !important;
            width: 90px !important;
            height: 90px !important;
          }
          .label-qr-code canvas,
          .label-qr-code img {
            width: 90px !important;
            height: 90px !important;
          }
        }
        .print-container {
          display: none;
        }
      `}</style>

      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <div className="xml-container">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center">XML Generator</h1>
          <form id="xmlForm">
            <div className="form-group">
              <label htmlFor="purchaseOrderNumber">Inkoopordernummer:</label>
              <input
                type="text"
                id="purchaseOrderNumber"
                value={purchaseOrderNumber}
                onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                required
                className="touch-manipulation"
              />
            </div>
            <div className="form-group">
              <label htmlFor="division">Divisie:</label>
              <select
                id="division"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                required
                className="touch-manipulation"
              >
                <option value="">-- Selecteer een divisie --</option>
                <option value="3960">Powertools (3960)</option>
                <option value="AID">KIT (AID)</option>
                <option value="HERV">Herverpakking AID</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="vendorCode">Leverancierscode: (automatisch)</label>
              <input
                type="text"
                id="vendorCode"
                value={vendorCode}
                readOnly
                className="auto-field"
              />
            </div>
            <div className="form-group">
              <label htmlFor="itemNumber">Artikelnummer:</label>
              <input
                type="text"
                id="itemNumber"
                value={itemNumber}
                onChange={(e) => setItemNumber(e.target.value)}
                required
                className="touch-manipulation"
              />
            </div>
            <div className="form-group">
              <label htmlFor="quantity">Hoeveelheid:</label>
              <input
                type="number"
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                min="1"
                required
                className="touch-manipulation"
              />
            </div>
            <div className="form-group">
              <label htmlFor="deliveryDate">Leveringsdatum: (automatisch +3 dagen)</label>
              <input
                type="date"
                id="deliveryDate"
                value={deliveryDate}
                readOnly
                className="auto-field"
              />
            </div>
            <div className="form-group">
              <label htmlFor="prepackVendorCode">Prepack Leverancierscode: (automatisch)</label>
              <input
                type="text"
                id="prepackVendorCode"
                value={prepackVendorCode}
                readOnly
                className="auto-field"
              />
            </div>

            <div className="actions">
              <button type="button" onClick={handleGenerateXML} className="touch-manipulation">
                Genereer XML
              </button>
              <button
                type="button"
                onClick={handleGenerateLabel}
                disabled={division !== '3960'}
                className="touch-manipulation"
              >
                Genereer Label
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={generatedXmls.length === 0}
                className="touch-manipulation"
              >
                Download XML
              </button>
              <button type="button" onClick={handleClear} className="touch-manipulation">
                Formulier wissen
              </button>
            </div>
          </form>

          {xmlOutput && (
            <div className="output">
              <h3>Gegenereerde XML:</h3>
              <pre>{xmlOutput}</pre>
            </div>
          )}

          {showLabelSection && (
            <div className="label-section">
              <h3>Label Preview (alleen voor Powertools):</h3>
              <div
                className="label-preview"
                dangerouslySetInnerHTML={{ __html: labelPreview }}
              />
              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <button type="button" onClick={handlePrintLabel} className="touch-manipulation">
                  Print Label
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
