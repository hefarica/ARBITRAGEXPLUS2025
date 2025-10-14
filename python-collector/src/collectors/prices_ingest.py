import time, requests
def fetch():
    # placeholder: fetch prices from a public endpoint
    r = requests.get("https://api.coindesk.com/v1/bpi/currentprice.json", timeout=10)
    print("price payload len:", len(r.text))
if __name__ == "__main__":
    fetch()
