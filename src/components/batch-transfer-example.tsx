"use client";

import { useSendCalls } from 'wagmi';
import { parseEther } from 'viem';
import { Button } from "~/components/ui/button";

export default function BatchTransfer() {
  const { sendCalls } = useSendCalls();

  return (
    <Button
      onClick={() => 
        sendCalls({
          calls: [
            {
              to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
              value: parseEther('0.01')
            },
            {
              to: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 
              value: parseEther('0.02')
            }
          ]
        })
      }
      className="bg-blue-600 hover:bg-blue-700 text-white"
    >
      Send Batch Transfer
    </Button>
  );
}