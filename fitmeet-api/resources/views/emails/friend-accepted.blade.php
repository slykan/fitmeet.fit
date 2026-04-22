<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Friend Request Accepted — FitMeet</title>
</head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a12;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          {{-- Logo --}}
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">
                <span style="color:#ffffff;">Fit</span><span style="color:#39FF14;">meet</span>
              </span>
            </td>
          </tr>

          {{-- Card --}}
          <tr>
            <td style="background:#16161f;border:1px solid #2a2a3a;border-radius:20px;padding:36px 32px;">

              {{-- Avatar --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    @if($acceptor->avatar)
                      <img src="{{ $acceptor->avatar }}" alt="{{ $acceptor->name }}"
                        width="72" height="72"
                        style="border-radius:50%;object-fit:cover;display:block;" />
                    @else
                      <div style="
                        width:72px;height:72px;border-radius:50%;
                        background:#39FF14;display:inline-flex;
                        align-items:center;justify-content:center;
                        font-size:28px;font-weight:800;color:#000;
                        line-height:72px;text-align:center;
                      ">{{ strtoupper(substr($acceptor->name, 0, 1)) }}</div>
                    @endif
                  </td>
                </tr>
              </table>

              {{-- Heading --}}
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;text-align:center;">
                You're now connected! 🎉
              </h1>
              <p style="margin:0 0 28px;font-size:14px;color:#8888aa;text-align:center;line-height:1.5;">
                <strong style="color:#ffffff;">{{ $acceptor->name }}</strong> accepted your friend request.
                @if($acceptor->home_city)
                  <br>{{ $acceptor->home_city }}{{ $acceptor->home_country ? ', ' . $acceptor->home_country : '' }}
                @endif
              </p>

              {{-- CTA --}}
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://fitmeet.fit/meet/"
                      style="
                        display:inline-block;background:#39FF14;color:#000;
                        font-weight:700;font-size:15px;text-decoration:none;
                        padding:14px 40px;border-radius:12px;
                      ">
                      View in Meet
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          {{-- Footer --}}
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-size:12px;color:#555570;line-height:1.6;">
                <a href="https://fitmeet.fit" style="color:#39FF14;text-decoration:none;">fitmeet.fit</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
