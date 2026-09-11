<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Event Time Changed — FitMeet</title>
</head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a12;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="https://fitmeet.fit/logo_c.png" alt="FitMeet" width="48" height="48"
                style="display:block;margin:0 auto 10px;" />
              <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">
                <span style="color:#ffffff;">Fit</span><span style="color:#39FF14;">meet</span>
              </span>
            </td>
          </tr>

          <tr>
            <td style="background:#16161f;border:1px solid #2a2a3a;border-radius:20px;padding:36px 32px;">
              @php
                $tz = $event->timezone ?? config('app.event_timezone');
                $newStart = $event->start_at->copy()->timezone($tz);
                $oldStart = $previousStartAt?->copy()->timezone($tz);
              @endphp

              <div style="font-size:46px;line-height:1;text-align:center;margin-bottom:20px;">🕒</div>

              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;text-align:center;">
                Event time changed
              </h1>
              <p style="margin:0 0 28px;font-size:14px;color:#8888aa;text-align:center;line-height:1.5;">
                Hi {{ $recipient->name }}, the organizer changed the date/time of an event you joined.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#0e0e1a;border:1px solid #2a2a3a;border-radius:14px;padding:20px;margin-bottom:24px;">
                <tr>
                  <td>
                    @if($event->category)
                    <div style="margin-bottom:12px;">
                      <span style="
                        display:inline-block;font-size:11px;font-weight:700;
                        color:#39FF14;border:1px solid #39FF14;
                        background:rgba(57,255,20,0.08);
                        padding:3px 10px;border-radius:999px;
                      ">{{ $event->category->label() }}</span>
                    </div>
                    @endif

                    <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#ffffff;line-height:1.3;">
                      {{ $event->title }}
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      @if($oldStart)
                      <tr>
                        <td style="padding-bottom:4px;">
                          <span style="color:#8888aa;font-size:13px;text-decoration:line-through;">
                            📅 &nbsp;{{ $oldStart->format('D, d M Y · H:i') }}
                          </span>
                        </td>
                      </tr>
                      @endif
                      <tr>
                        <td style="padding-bottom:8px;">
                          <span style="color:#39FF14;font-size:13px;font-weight:700;">
                            📅 &nbsp;{{ $newStart->format('D, d M Y · H:i') }}
                          </span>
                        </td>
                      </tr>
                      @if($event->address)
                      <tr>
                        <td style="padding-bottom:8px;">
                          <span style="color:#8888aa;font-size:13px;">
                            📍 &nbsp;{{ $event->address }}
                          </span>
                        </td>
                      </tr>
                      @endif
                      @if($event->organizer)
                      <tr>
                        <td>
                          <span style="color:#8888aa;font-size:13px;">
                            👤 &nbsp;Organized by {{ $event->organizer->name }}
                          </span>
                        </td>
                      </tr>
                      @endif
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://fitmeet.fit/events/view?id={{ $event->id }}"
                      style="
                        display:inline-block;background:#39FF14;color:#000;
                        font-weight:700;font-size:15px;text-decoration:none;
                        padding:14px 40px;border-radius:12px;
                      ">
                      View details →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

</body>
</html>
