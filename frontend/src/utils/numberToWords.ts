export function numberToWordsRupees(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '';
  const num = Math.floor(Math.abs(amount));
  if (num === 0) return 'Zero Rupees only';

  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertLessThanThousand(n: number): string {
    let str = '';
    if (n >= 100) {
      str += single[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 10 && n <= 19) {
      str += teens[n - 10] + ' ';
    } else {
      if (n >= 20) {
        str += tens[Math.floor(n / 10)] + ' ';
        n %= 10;
      }
      if (n > 0) {
        str += single[n] + ' ';
      }
    }
    return str;
  }

  let words = '';
  let crore = Math.floor(num / 10000000);
  let remainder = num % 10000000;
  let lakh = Math.floor(remainder / 100000);
  remainder %= 100000;
  let thousand = Math.floor(remainder / 1000);
  remainder %= 1000;

  if (crore > 0) words += convertLessThanThousand(crore) + 'Crore ';
  if (lakh > 0) words += convertLessThanThousand(lakh) + 'Lakh ';
  if (thousand > 0) words += convertLessThanThousand(thousand) + 'Thousand ';
  if (remainder > 0) words += convertLessThanThousand(remainder);

  return `${words.trim()} Rupees only`;
}
