import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState(5);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card: elements.getElement(CardElement),
      billing_details: {
        name,
      },
    });

    if (error) {
      console.error(error);
      alert(error.message);
    } else {
      const res = await fetch("http://localhost:4242/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount * 100, // Stripe uses cents
          payment_method: paymentMethod.id,
          name,
          message,
        }),
      });

      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert("Donation successful! 🎉");
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 max-w-md mx-auto bg-gray-800 rounded flex flex-col gap-3"
    >
      <h2 className="text-white text-lg font-bold">Make a donation</h2>

      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="p-2 rounded bg-gray-900 text-white"
      />

      <textarea
        placeholder="Your message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="p-2 rounded bg-gray-900 text-white"
      />

      <input
        type="number"
        placeholder="Amount (USD)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="p-2 rounded bg-gray-900 text-white"
      />

      <div className="p-2 border rounded bg-gray-900">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#fff",
                "::placeholder": {
                  color: "#888",
                },
              },
              invalid: {
                color: "#ff4d4f",
              },
            },
          }}
        />
      </div>

      <button
        type="submit"
        disabled={!stripe}
        className="bg-gradient-to-r from-green-400 to-blue-500 text-white p-2 rounded hover:opacity-80 transition"
      >
        Donate
      </button>
    </form>
  );
}

function App() {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  );
}

export default App;
