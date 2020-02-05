import { flatMap } from 'rxjs/operators';
import Envelope from './envelope';

export default function acknowledgeEnvelopeObservable<T>() {
  return flatMap(async (envelope: Envelope<T>) => {
    if (envelope.acknowledge) {
      await envelope.acknowledge();
    }
    return envelope.message;
  });
}
