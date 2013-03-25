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
