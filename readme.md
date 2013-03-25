# Arm610

This is an attempt to build an ARM610 emulator in Javascript. Right now I'm
justing aiming to get a working processor emulator. Eventually, I might expand
this to be an Archimedes RiscPC emulator. That is a long way off.

The motivations for this project are two fold. Firstly I'm building this to
learn how computers work. Secondly, I have fond memories of programming
RiscPCs (which were powered by an ARM610 processor). It is also an interesting
project because code that runs on an ARM610 should also run against more
modern ARM processors, which power many (most?) mobile devices.

I'm coming into this project knowing very little about ARM, processors in
general, or Javascript. So building an ARM emulator in Javascript is
certainly _interesting_.

The resources I'm working from include:

 - http://www.renan.org/ARM/doc/ARM610VD.pdf
 - https://github.com/hulkholden/n64js
 - http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-The-CPU
 - http://ejohn.org/apps/learn/#67
 - http://www.coranac.com/tonc/text/asm.htm


### Progress

So far I've learned an enormous amount about how the core ARM processor works.
I haven't started on the MMU yet - that will have to wait.

I'm building the emulator to run programs. These are programs built in C
and then cross-compiled from my Mac for ARM610 processors. I don't have any
kind of operating system or program runner, so at this stage I'm just
manually loading in a program at address 0 and specifying an arbitrary
memory location for the stack pointer (R13). This seems to be the minimum
needed for the [ARM Procedure Call Standard](http://infocenter.arm.com/help/topic/com.arm.doc.ihi0042d/IHI0042D_aapcs.pdf)
(which I guess GCC is adhering to). I turned off the use of a Frame Pointer
until I figure out exactly what that is.

The current program I'm trying to run is `count.c` (see below), which is close
to executing but still doesn't quite run properly.


## Generating ARM610 code

### Toolchain setup

My first attempt was to follow these two guides:

http://www.ethernut.de/en/documents/cross-toolchain-osx.html
http://stackoverflow.com/questions/9450394/how-to-install-gcc-from-scratch-with-gmp-mpfr-mpc-elf-without-shared-librari

However, this didn't work. So.. went for this:

http://cowlark.com/2009-07-04-building-gcc/

With some bits of the above cherry-picked. This _did_ work.

    sudo ../gcc-4.7.2/configure --target=arm-elf --prefix=$prefix --enable-multilib --disable-libssp --disable-shared --disable-threads --enable-obsolete -v --enable-languages=c


### Compiling C

These are the three steps (C to Assembler, Assembler to [ELF](http://stackoverflow.com/questions/2427011/what-is-the-difference-between-elf-files-and-bin-files),
ELF to binary):

    arm-elf-gcc -mcpu=arm610 -O0 -S count.c
    arm-elf-as -o 42.elf 42.s
    arm-elf-objcopy -O binary 42.elf 42.bin

NOTE: the flag `-O0` turns off all optimisations which is useful when we
have a very simple C program that we just want to turn into some valid binary;
otherwise everything tends to get optimised away.

This is the Assembler for `return 42`;

            .file	"42.c"
            .text
            .align	2
            .global	main
            .type	main, %function
    main:
            @ args = 0, pretend = 0, frame = 0
            @ frame_needed = 1, uses_anonymous_args = 0
            @ link register save eliminated.
            str	fp, [sp, #-4]!
            add	fp, sp, #0
            mov	r3, #42
            mov	r0, r3
            add	sp, fp, #0
            ldmfd	sp!, {fp}
            mov	pc, lr
            .size	main, .-main
            .ident	"GCC: (GNU) 4.7.2"

Or simpler still, with optimisations:

            .file	"42.c"
            .section	.text.startup,"ax",%progbits
            .align	2
            .global	main
            .type	main, %function
    main:
            @ args = 0, pretend = 0, frame = 0
            @ frame_needed = 0, uses_anonymous_args = 0
            @ link register save eliminated.
            mov	r0, #42
            mov	pc, lr
            .size	main, .-main
            .ident	"GCC: (GNU) 4.7.2"

Which yields binary:

    94:c davegardner$ xxd 42.bin 
    0000000: 2a00 a0e3 0ef0 a0e1                      *.......

    2a 00 a0 e3        00101010 00000000 10100000 11100011
    0e f0 a0 e1        00001110 11110000 10100000 11100001

This is a **little endian** program, which means that the least significant
byte of a word appears first in this representation. We can therefore
shuffle stuff around to construct the two 32-bit instructions:

    1110 00 1   1101    0    0000   0000    0000    00101010
            I   opcode  S    RN     RD      rotate  operand 2 value
                                                    42!!

    1110 00 0   1101    0    0000   1111    0000 0000   1110
                                            <no shift>  2nd operand register

### More advanced program

This is a program which works out the sum of the numbers 0 to 99 inclusive.

    int main (void)
    {
        int total,c;

        for (c=0; c<100; c++) {
            total += c;
        }

        return total;
    }

With optimisations disabled, this compiles to the assembler 

            .file	"count.c"
            .text
            .align	2
            .global	main
            .type	main, %function
    main:
            @ args = 0, pretend = 0, frame = 8
            @ frame_needed = 1, uses_anonymous_args = 0
            @ link register save eliminated.
            str	fp, [sp, #-4]!
            add	fp, sp, #0
            sub	sp, sp, #8
            mov	r3, #0
            str	r3, [fp, #-8]
            b	.L2
    .L3:
            ldr	r2, [fp, #-4]
            ldr	r3, [fp, #-8]
            add	r3, r2, r3
            str	r3, [fp, #-4]
            ldr	r3, [fp, #-8]
            add	r3, r3, #1
            str	r3, [fp, #-8]
    .L2:
            ldr	r3, [fp, #-8]
            cmp	r3, #99
            ble	.L3
            ldr	r3, [fp, #-4]
            mov	r0, r3
            add	sp, fp, #0
            ldmfd	sp!, {fp}
            mov	pc, lr
            .size	main, .-main
            .ident	"GCC: (GNU) 4.7.2"

This introduced a couple of new concepts for me - the **stack pointer** (SP., R13)
and the **frame pointer** (FP, R11).

It is possible to compile _without_ the FP. Being that I have no idea how to
set it up, and I don't have an OS that's loading my program, this makes life
easier. For now, my _very simple_ program loader chooses an arbitrary memory
address for the SP and assigns it to R13 on load.

    arm-elf-gcc -mcpu=arm610 -O0 -fomit-frame-pointer -S count.c

Now we have:

            .file	"count.c"
            .text
            .align	2
            .global	main
            .type	main, %function
    main:
            @ args = 0, pretend = 0, frame = 8
            @ frame_needed = 0, uses_anonymous_args = 0
            @ link register save eliminated.
            sub	sp, sp, #8
            mov	r3, #0
            str	r3, [sp, #0]
            b	.L2
    .L3:
            ldr	r2, [sp, #4]
            ldr	r3, [sp, #0]
            add	r3, r2, r3
            str	r3, [sp, #4]
            ldr	r3, [sp, #0]
            add	r3, r3, #1
            str	r3, [sp, #0]
    .L2:
            ldr	r3, [sp, #0]
            cmp	r3, #99
            ble	.L3
            ldr	r3, [sp, #4]
            mov	r0, r3
            add	sp, sp, #8
            mov	pc, lr
            .size	main, .-main
            .ident	"GCC: (GNU) 4.7.2"

Which is the binary:

    0000000: 08d0 4de2 0030 a0e3 0030 8de5 0600 00ea  ..M..0...0......
    0000010: 0420 9de5 0030 9de5 0330 82e0 0430 8de5  . ...0...0...0..
    0000020: 0030 9de5 0130 83e2 0030 8de5 0030 9de5  .0...0...0...0..
    0000030: 6300 53e3 f5ff ffda 0430 9de5 0300 a0e1  c.S......0......
    0000040: 08d0 8de2 0ef0 a0e1                      ........

