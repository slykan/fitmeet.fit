<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class FriendAcceptedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $acceptor,  // person who accepted
        public User $requester, // person who sent the original request
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "{$this->acceptor->name} accepted your friend request on FitMeet",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.friend-accepted');
    }
}
