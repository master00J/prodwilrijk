declare module 'nodemailer' {
  const nodemailer: {
    createTransport: (...args: any[]) => any
  }

  export default nodemailer
}
