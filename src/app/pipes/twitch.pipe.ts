import { Pipe, PipeTransform } from '@angular/core';
import { TwitchVideo } from '../queue/twitch-queue.service';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
  name: 'twitch',
})
export class TwitchPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(video: TwitchVideo, type: string): any {
    switch (type) {
      case 'thumbnail':
        return video.thumbnail_url.replace('%{width}', '1280').replace('%{height}', '720');
      case 'embedUrl':
        return this.sanitizer.bypassSecurityTrustResourceUrl(`//player.twitch.tv/?video=${video.id}&parent=localhost&time=${video.offset}`);
      default:
        return null;
    }
  }
}
