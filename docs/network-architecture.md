```mermaid
    flowchart TB
        PC_A["PC A<br/>IP: 10.0.1.10/24<br/>Gateway: 10.0.1.1"]
        R1["Router 1<br/>G0/0/0: 10.0.1.1<br/>G0/0/1: 10.0.2.1"]
        R2["Router 2<br/>G0/0/0: 10.0.2.2<br/>G0/0/1: 10.0.3.1"]
        PC_B["PC B<br/>IP: 10.0.3.10/24<br/>Gateway: 10.0.3.1"]

        PC_A <-->|"10.0.1.0/24"| R1
        R1 <-->|"10.0.2.0/30"| R2
        R2 <-->|"10.0.3.0/24"| PC_B

        R1 -.->|"Static route: 10.0.3.0/24"| R2
        R2 -.->|"Static route: 10.0.1.0/24"| R1
