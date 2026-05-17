<?php

namespace App\Mail;

use App\Models\Event;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class EventStartedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Event $event, public User $user) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Your event starts soon: {$this->event->title}",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.event-started');
    }

    public function attachments(): array
    {
        return [];
    }
}
