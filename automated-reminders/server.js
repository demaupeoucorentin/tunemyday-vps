const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')
const cron = require('node-cron')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)

async function sendReminderEmail(email, previewId) {
    const url = `https://www.tunemyday.fr/music/preview/${previewId}`
    await resend.emails.send({
        from: 'TuneMyDay <noreply@tunemyday.fr>',
        to: [email],
        subject: '⏳ Votre extrait vous attend toujours !',
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Rappel : votre extrait vous attend</title></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background-color:#f6f9fc">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:10px;padding:30px;box-shadow:0 2px 4px rgba(0,0,0,0.1)">
    <div style="text-align:center;margin-bottom:30px">
      <h1 style="color:#1E1E3F;margin-bottom:10px">Votre extrait est toujours disponible !</h1>
    </div>
    <div style="background:linear-gradient(135deg,#FEC260 0%,#F5564E 100%);padding:20px;border-radius:10px;text-align:center;margin-bottom:30px">
      <p style="color:white;font-size:16px;line-height:1.5">Retrouvez votre extrait ici :</p>
      <a href="${url}" style="display:inline-block;margin-top:15px;background:white;color:#F5564E;text-decoration:none;padding:15px 30px;border-radius:25px;font-weight:bold;font-size:16px">Écouter mon extrait</a>
    </div>
    <div style="text-align:center;color:#666;font-size:14px">
      <p>Utilisez le code promo <strong>MELODY20</strong> pour bénéficier de 20 % de réduction.</p>
      <p style="margin-top:20px">Mais dépêchez-vous, il expire dans quelques heures !</p>
    </div>
  </div>
</body>
</html>`
    })
}

cron.schedule('0 * * * *', async () => {
    const { data: rows, error } = await supabase
        .from('music_previews')
        .select('email, preview_id, is_first_reminder_sent')
        .or('checkout_success.is.null,checkout_success.eq.false')

    if (!rows || error) return
    const toRemind = rows.filter(r => !r.is_first_reminder_sent)
    for (const { email, preview_id } of toRemind) {
        try {
            await sendReminderEmail(email, preview_id)
            await supabase
                .from('music_previews')
                .update({ is_first_reminder_sent: true })
                .eq('preview_id', preview_id)
        } catch { }
    }
})

process.stdin.resume()
