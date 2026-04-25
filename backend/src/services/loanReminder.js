const nodemailer = require('nodemailer');
const { Op } = require('sequelize');
const { ActiveLoan, Article, User } = require('../models');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined
});

async function checkOverdueLoans() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const overdueLoans = await ActiveLoan.findAll({
      where: {
        due_date: { [Op.lt]: today },
        reminder_sent: false
      },
      include: [
        { model: Article, as: 'article' },
        { model: User, as: 'user' }
      ]
    });

    for (const loan of overdueLoans) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@mokilager.at',
          to: loan.user.email,
          subject: `[MOKILager] Rückgabe überfällig: ${loan.article.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #e30613; color: white; padding: 20px; text-align: center;">
                <h2>MOKILager – Rückgabe Erinnerung</h2>
              </div>
              <div style="padding: 20px;">
                <p>Liebe/r ${loan.user.full_name},</p>
                <p>die Leihfrist für folgendes Gerät ist abgelaufen:</p>
                <table style="width:100%; border-collapse: collapse; margin: 15px 0;">
                  <tr style="background: #f5f5f5;">
                    <td style="padding: 10px; font-weight: bold;">Gerät:</td>
                    <td style="padding: 10px;">${loan.article.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; font-weight: bold;">Ausgeliehen:</td>
                    <td style="padding: 10px;">${new Date(loan.loan_date).toLocaleDateString('de-AT')}</td>
                  </tr>
                  <tr style="background: #f5f5f5;">
                    <td style="padding: 10px; font-weight: bold;">Fällig seit:</td>
                    <td style="padding: 10px; color: #e30613; font-weight: bold;">${new Date(loan.due_date).toLocaleDateString('de-AT')}</td>
                  </tr>
                </table>
                <p>Bitte geben Sie das Gerät so rasch wie möglich zurück. Scannen Sie dazu den QR-Code am Gerät oder melden Sie sich im System an.</p>
                <p>Bei Fragen wenden Sie sich bitte an Ihren MOKI-Verwalter.</p>
                <hr>
                <p style="color: #888; font-size: 12px;">Diese E-Mail wurde automatisch vom MOKILager-System generiert.</p>
              </div>
            </div>
          `
        });

        loan.reminder_sent = true;
        await loan.save();
        console.log(`[REMINDER] Sent to ${loan.user.email} for ${loan.article.name}`);
      } catch (mailErr) {
        console.error(`[REMINDER] Failed to send to ${loan.user.email}:`, mailErr.message);
      }
    }
  } catch (err) {
    console.error('[REMINDER] Error:', err);
  }
}

module.exports = { checkOverdueLoans };
