<?php

namespace App\Mail;

use App\Models\Event;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NewEventMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Event $event,
        public readonly User  $recipient,
    ) {}

    public function envelope(): Envelope
    {
        $category = $this->event->category?->label() ?? 'Event';

        return new Envelope(
            subject: "🏃 New {$category} event near you — {$this->event->title}",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.new-event');
    }

    public function attachments(): array { return []; }
}
