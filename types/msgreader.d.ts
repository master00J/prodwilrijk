declare module '@kenjiuno/msgreader' {
  export default class MSGReader {
    constructor(arrayBuffer: ArrayBuffer)
    getFileData(): {
      subject?: string
      senderName?: string
      senderEmail?: string
      clientSubmitTime?: string
      messageDeliveryTime?: string
    }
  }
}
