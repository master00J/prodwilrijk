declare module '@kenjiuno/msgreader' {
  export default class MSGReader {
    constructor(arrayBuffer: ArrayBuffer | Buffer)
    getFileData(): {
      error?: string
      subject?: string
      senderName?: string
      senderEmail?: string
      clientSubmitTime?: string
      messageDeliveryTime?: string
      body?: string
      bodyHtml?: string
      html?: string
      headers?: string
      compressedRtf?: Uint8Array | Buffer | number[]
      innerMsgContentFields?: {
        body?: string
        bodyHtml?: string
        html?: string
        headers?: string
        compressedRtf?: Uint8Array | Buffer | number[]
      }
    }
  }
}

declare module '@kenjiuno/decompressrtf' {
  export function decompressRTF(input: Uint8Array): Uint8Array
}
