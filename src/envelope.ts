export default interface Envelope<T> {
  message: T;
  acknowledge?: () => void;
}
