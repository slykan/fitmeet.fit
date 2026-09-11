<?php

namespace App\Mail;

use App\Models\Event;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;

class EventRescheduledMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Event $event,
        public readonly User $recipient,
        public readonly ?Carbon $previousStartAt = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Event time changed — {$this->event->title}",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.event-rescheduled');
    }

    public function attachments(): array
    {
        return [];
    }
}
