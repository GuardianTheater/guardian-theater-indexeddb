import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { TwitchVideo } from '../types';
import { environment } from 'src/environments/environment';

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
        return this.sanitizer.bypassSecurityTrustResourceUrl(
          `//player.twitch.tv/?video=${video.id}&parent=${environment.twitch.parent}&time=${video.offset}`
        );
      default:
        return null;
    }
  }
}
