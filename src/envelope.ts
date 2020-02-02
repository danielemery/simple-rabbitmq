export default interface Envelope<T> {
  /** The wrapped message. */
  message: T;
  /** Function to acknowledge recieval of message (if acknowledgements are enabled). */
  acknowledge?: () => void;
}
