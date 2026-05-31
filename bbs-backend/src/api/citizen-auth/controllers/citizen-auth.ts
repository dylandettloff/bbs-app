import crypto from 'crypto';

function cleanCitizenId(value: unknown) {
  return String(value ?? '').replace(/[^0-9]/g, '');
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #eef3fa; color: #0e1726; }
    main { max-width: 430px; margin: 0 auto; padding: 32px 18px; }
    section { background: white; border: 1px solid #ccd7e6; border-radius: 18px; padding: 22px; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
    h1 { margin: 0 0 10px; color: #12345c; font-size: 26px; }
    p { color: #56657c; line-height: 1.5; }
    label { display: block; margin-top: 14px; font-weight: 800; color: #12345c; }
    input { width: 100%; box-sizing: border-box; margin-top: 6px; padding: 12px; border-radius: 10px; border: 1px solid #ccd7e6; font-size: 16px; }
    button { width: 100%; margin-top: 18px; padding: 13px; border: 0; border-radius: 12px; background: #004680; color: white; font-weight: 900; font-size: 16px; }
  </style>
</head>
<body><main><section>${body}</section></main></body>
</html>`;
}

function resetLink(token: string) {
  const baseUrl = process.env.PUBLIC_URL || strapi.config.get('server.absoluteUrl') || '';
  return `${String(baseUrl).replace(/\/$/, '')}/api/citizen-auth/reset-password?code=${token}`;
}

export default {
  async forgotPassword(ctx: any) {
    const citizenId = cleanCitizenId(ctx.request.body?.citizenId);

    if (!citizenId) {
      return ctx.badRequest('Citizen ID is required.');
    }

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: {
        username: citizenId,
        blocked: false,
      },
    });

    if (!user?.email) {
      ctx.body = { ok: true };
      return;
    }

    const resetPasswordToken = crypto.randomBytes(64).toString('hex');
    await (strapi.plugin('users-permissions') as any).service('user').edit(user.id, {
      resetPasswordToken,
    });

    await strapi.plugin('email').service('email').send({
      to: user.email,
      subject: 'Reset your Badger Boys State password',
      text: `Use this link to reset your password: ${resetLink(resetPasswordToken)}`,
      html: `<p>Use this link to reset your Badger Boys State password:</p><p><a href="${resetLink(
        resetPasswordToken
      )}">${resetLink(resetPasswordToken)}</a></p>`,
    });

    ctx.body = { ok: true };
  },

  async resetPasswordPage(ctx: any) {
    const code = String(ctx.query?.code ?? '');

    if (!code) {
      ctx.type = 'html';
      ctx.body = page(
        'Reset Password',
        '<h1>Reset Password</h1><p>This reset link is missing a code.</p>'
      );
      return;
    }

    ctx.type = 'html';
    ctx.body = page(
      'Reset Password',
      `<h1>Reset Password</h1>
      <p>Enter a new password for your Badger Boys State account.</p>
      <form method="post" action="/api/citizen-auth/reset-password">
        <input type="hidden" name="code" value="${escapeHtml(code)}" />
        <label for="password">New password</label>
        <input id="password" name="password" type="password" required minlength="6" autocomplete="new-password" />
        <label for="passwordConfirmation">Confirm password</label>
        <input id="passwordConfirmation" name="passwordConfirmation" type="password" required minlength="6" autocomplete="new-password" />
        <button type="submit">Reset Password</button>
      </form>`
    );
  },

  async resetPassword(ctx: any) {
    const code = String(ctx.request.body?.code ?? '');
    const password = String(ctx.request.body?.password ?? '');
    const passwordConfirmation = String(ctx.request.body?.passwordConfirmation ?? '');

    ctx.type = 'html';

    if (!code || !password || password.length < 6 || password !== passwordConfirmation) {
      ctx.status = 400;
      ctx.body = page(
        'Reset Password',
        '<h1>Reset Password</h1><p>The reset form was incomplete or the passwords did not match.</p>'
      );
      return;
    }

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: {
        resetPasswordToken: code,
        blocked: false,
      },
    });

    if (!user) {
      ctx.status = 400;
      ctx.body = page(
        'Reset Password',
        '<h1>Reset Password</h1><p>This reset link is invalid or has already been used.</p>'
      );
      return;
    }

    await (strapi.plugin('users-permissions') as any).service('user').edit(user.id, {
      password,
      resetPasswordToken: null,
    });

    ctx.body = page(
      'Password Updated',
      '<h1>Password Updated</h1><p>Your password has been reset. You can return to the app and sign in now.</p>'
    );
  },
};
