<?php

namespace App\Mail;

use App\Models\EventReminder;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class EventReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public EventReminder $reminder) {}

    public function envelope(): Envelope
    {
        $label  = match ($this->reminder->remind_offset) {
            '1h' => '1 hour',
            '5h' => '5 hours',
            '1d' => 'tomorrow',
            default => 'soon',
        };

        return new Envelope(
            subject: "⏰ Reminder: {$this->reminder->event->title} is {$label}!",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.event-reminder');
    }

    public function attachments(): array { return []; }
}
