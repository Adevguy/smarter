const nodemailer = require("nodemailer")

const transporter = nodemailer.createTransport({
    service: "Mailgun",
    auth: {
        user: process.env.MAILGUN_USER,
        pass: process.env.MAILGUN_PASS
    }
})

const sendEmail = async (name, email, phoneNumber, product, message) => {

    const mailOptions = {
        from: "DevDou " + process.env.MAILGUN_USER,
        to: "devdou180@gmail.com",
        subject: "Incoming message",
text: `لديك رسالة جديدة من ${name} (${email}، ${phoneNumber}) بخصوص ${product}: ${message}`,
html: `<p>لديك رسالة جديدة من <strong>${name}</strong> (${email}، ${phoneNumber}) بخصوص <strong>${product}</strong>:</p>
       <p>${message}</p>`

    }

    try{
        await transporter.sendMail(mailOptions)
    }
    catch (error) {
        console.error("Error sending the email.", error)
    }
}

module.exports = { sendEmail }