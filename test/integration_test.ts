import { Rabbit, publishObservable } from '../index';
import { range } from 'rxjs';
import { map } from 'rxjs/operators';
import observeRabbit from '../src/observeRabbit';

function printObservable(message: string) {
  return map(value => {
    console.log(`${message} ${JSON.stringify(value)}.`);
    return value;
  });
}

async function runIntegrationTest() {
  const rabbit = new Rabbit({
    host: 'localhost',
    port: '5672',
    user: 'simple-rabbitmq',
    password: 'simple-rabbitmq',
  });
  await rabbit.connect();

  const { observable, cancel } = await observeRabbit(rabbit, 'test_exchange');
  console.log('Now Listening');

  observable.pipe(printObservable('Recieved Message')).subscribe();

  await range(0, 10)
    .pipe(
      map(num => ({
        text: `Test Message ${num}`,
      })),
      printObservable('Sent Message'),
      publishObservable(rabbit, 'test_exchange'),
    )
    .toPromise();

  await cancel();
  console.log('No Longer Listening');

  await range(0, 10)
    .pipe(
      map(num => ({
        text: `Second Test Message ${num}`,
      })),
      printObservable('Sent Message'),
      publishObservable(rabbit, 'test_exchange'),
    )
    .toPromise();

  await rabbit.deleteExchange('test_exchange');
  await rabbit.disconnect();
  return;
}

console.log('Starting integration test');
runIntegrationTest()
  .then(() => console.log('Integration test completed successfully.'))
  .catch(err => {
    console.error(err);
  });
